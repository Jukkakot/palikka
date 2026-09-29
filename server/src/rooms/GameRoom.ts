import { randomInt } from "node:crypto";
import { ErrorCode, matchMaker, ServerError, type Client, type CloseCode, type Deferred } from "colyseus";
import {
  autoplayPayloadSchema,
  BOT_NAMES,
  botSeatPayloadSchema,
  CLOSE_CODES,
  joinOptionsSchema,
  kickPayloadSchema,
  MAX_SPECTATORS,
  placePayloadSchema,
  rematchPayloadSchema,
  speedPayloadSchema,
  startPayloadSchema,
  type JoinErrorCode,
  type JoinOptions,
  type TurnPhase,
} from "@palikka/protocol";
import {
  applyPlace,
  botRngFor,
  botViewOf,
  CELL_COUNT,
  cellAt,
  cellIndex,
  chooseBotCell,
  DISCONNECT_LIMIT_SECONDS,
  endGame,
  kickRejection,
  MAX_SEED,
  MIN_SEATS,
  removeSeat,
  startGame,
  TURN_TIME_LIMIT_SECONDS,
  type BotStrategy,
  type Cell,
  type GameCommandResult,
  type GameState as Game,
} from "@palikka/rules";
import type { z } from "zod";
import { log, type LogFields } from "../logging/logger.js";
import { CommandRejection, type Actor } from "./command.js";
import { LoggedRoom } from "./LoggedRoom.js";
import { GameState, Player } from "./schema/GameState.js";

export const MAX_SEATS = 4;

/** At most this many games exist at a time (one 0 € instance); creating more is refused. */
export const MAX_OPEN_GAMES = 100;

/** Listing metadata the lobby's game list shows and filters on. */
export interface GameMetadata {
  /** The host's nickname; "" until the host has joined. */
  host: string;
  /** True while the game is in its waiting room. */
  open: boolean;
  /** Matchmaking pool: "" for real players, set by E2E tests. */
  pool: string;
  /** Seats taken by people and bots; the list shows it and hides a game with all 4 taken. */
  seated: number;
  /** True while the game runs and has room for another spectator: the start screen lists it to watch. */
  watchable: boolean;
}

/** Why the room was closed for everyone (`room.closed`). */
type CloseReason = "hostLeft";

/** Why a player was taken out of the game (`player.removed`). */
type RemovalReason = "left" | "kicked" | "timeout";

/** Why a person's seat is auto-played: they handed it over, or their connection dropped. */
type AutoplayReason = "player" | "drop";

/** Why a started game ended (`game.finished`). */
type FinishReason = "complete" | "lastPlayer" | "noPeople";

/** A bot's key in `state.players`; it can never clash with a Colyseus sessionId. */
const botKey = (seat: number) => `bot:${seat}`;

/** Default pause before a bot's turn, so people can follow it. */
export const BOT_DELAY_MS = 1000;

/** Refuses a join or room creation: the client reads `code` from the error message. */
const refuse = (code: JoinErrorCode) =>
  new ServerError(code === "INVALID_NICKNAME" ? ErrorCode.AUTH_FAILED : ErrorCode.APPLICATION_ERROR, code);

/** Why join options were refused: the nickname, or any other field (`bots`, `pool` …). */
const refusalOf = (error: z.ZodError): "nickname" | "options" =>
  error.issues.some((issue) => issue.path[0] === "nickname") ? "nickname" : "options";

/**
 * One Palikka game: a board and up to four seated players. It starts in the
 * waiting room, where players take seats; the host (the first to join) starts the game.
 */
export class GameRoom extends LoggedRoom<{ state: GameState; metadata: GameMetadata }> {
  maxClients = MAX_SEATS;
  state = new GameState();

  /** Games that exist now, across all rooms of this process. */
  static openGames = 0;
  /** The cap on `openGames`; room tests lower it. */
  static maxOpenGames = MAX_OPEN_GAMES;

  /** Turn time limit; room tests shorten it. */
  turnLimitMs = TURN_TIME_LIMIT_SECONDS * 1000;
  /** How long a dropped player keeps their seat; room tests shorten it. */
  disconnectLimitSeconds = DISCONNECT_LIMIT_SECONDS;

  /** Draws the game's seed at the start; room tests replace it. */
  drawDealSeed = () => randomInt(0, MAX_SEED + 1);
  /** The first seat: the rule's choice (the host); room tests replace it to start elsewhere. */
  chooseStartSeat = (seat: number) => seat;

  /** How bots choose their turns; replaceable (a smarter strategy, or a bad one in tests). */
  botStrategy: BotStrategy = chooseBotCell;
  /** Pause before a bot's turn; room tests shorten it. */
  botDelayMs = BOT_DELAY_MS;

  /**
   * The started game as the rules engine holds it (the one source of the rules' truth); the
   * synced state mirrors it. Undefined in the waiting room.
   */
  private game?: Game;
  /** True while the room is being closed for everyone: dropped connections hold no seat. */
  private closing = false;
  /** The matchmaking pool, which a rematch copies. */
  private pool = "";
  /** Seats that held a bot when the game started (a rematch seats bots there again). */
  private startBotSeats: number[] = [];
  /** Spectators by sessionId, dropped ones in their hold included. */
  private spectators = new Set<string>();
  /** The rematch game being created; a second request waits for the same one. */
  private rematchPending?: Promise<void>;
  /** True once this room counts towards `openGames`. */
  private counted = false;
  private turnTimer?: { clear(): void };
  /** The pending step of a bot's turn; at most one per room. */
  private botTimer?: { clear(): void };
  /** Auto-played people by sessionId, with why (a reconnect ends only a drop's autoplay). */
  private autoplay = new Map<string, AutoplayReason>();
  /** Seat holds of dropped players, by sessionId; rejecting one removes that player at once. */
  private holds = new Map<string, Deferred<Client>>();

  messages = {
    start: this.command("start", startPayloadSchema, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new CommandRejection("NOT_SEATED");
      if (player.seat !== this.state.hostSeat) throw new CommandRejection("NOT_HOST", { seat: player.seat });
      if (this.state.phase !== "waiting") throw new CommandRejection("WRONG_PHASE", { expected: "waiting" });
      if (this.state.players.size < MIN_SEATS) throw new CommandRejection("NOT_ENOUGH_PLAYERS", { seated: this.state.players.size });
      this.startGame();
    }),

    addBot: this.command("addBot", botSeatPayloadSchema, (client, { seat }) => {
      this.requireHostInWaitingRoom(client);
      if (this.seatHolder(seat) || this.pendingSeats().includes(seat)) throw new CommandRejection("SEAT_TAKEN", { seat });

      this.seatBot(seat);
    }),

    removeBot: this.command("removeBot", botSeatPayloadSchema, (client, { seat }) => {
      this.requireHostInWaitingRoom(client);
      const bot = this.seatHolder(seat);
      if (!bot?.bot) throw new CommandRejection("NOT_A_BOT", { seat });

      this.state.players.delete(botKey(seat));
      log.info("bot.removed", this.logCtx(undefined, { seat, name: bot.name }));
      this.syncSeats();
    }),


    place: this.command("place", placePayloadSchema, (client, cell) => {
      const player = this.requirePlaying(client);
      this.game = this.accepted(this.game && applyPlace(this.game, player.seat, cell), player.seat, cell);

      this.state.cells[cellIndex(cell)] = player.seat;
      player.placed = this.gameSeat(player.seat).placed;
      this.state.turn = this.game.turn;
      if (this.game.step === "finished") this.finish(this.game.winnerSeat, "complete");
      else this.setTurn(this.game.turnSeat);
    }),

    setAutoplay: this.command("setAutoplay", autoplayPayloadSchema, (client, { on }) => {
      this.requireSeated(client);
      if (!this.running()) throw new CommandRejection("WRONG_PHASE", { expected: "play" });
      if (on) this.startAutoplay(client.sessionId, "player");
      else this.stopAutoplay(client.sessionId, "player");
    }),

    setSpeed: this.command("setSpeed", speedPayloadSchema, (client, { speed }) => {
      if (!this.spectators.has(client.sessionId)) throw new CommandRejection("NOT_SPECTATOR");
      if (!this.running()) throw new CommandRejection("WRONG_PHASE", { expected: "play" });
      if (this.people().length > 0) throw new CommandRejection("PEOPLE_PLAYING", { people: this.people().length });
      this.state.botSpeed = speed;
    }),

    rematch: this.command("rematch", rematchPayloadSchema, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new CommandRejection("NOT_SEATED");
      if (this.state.phase !== "finished") throw new CommandRejection("WRONG_PHASE", { expected: "finished" });
      if (this.state.rematchRoomId) return;
      this.rematchPending ??= this.createRematch(player.name).finally(() => (this.rematchPending = undefined));
      await this.rematchPending;
    }),

    kick: this.command("kick", kickPayloadSchema, (client, { seat }) => {
      const kicker = this.state.players.get(client.sessionId);
      if (!kicker) throw new CommandRejection("NOT_SEATED");
      const code = kickRejection({
        kicker: kicker.seat,
        target: seat,
        turnSeat: this.state.turnSeat,
        expired: this.state.turnExpired,
        waiting: this.state.phase === "waiting",
        finished: this.state.phase === "finished",
      });
      if (code) throw new CommandRejection(code, { target: seat });

      const targetId = [...this.state.players.entries()].find(([, p]) => p.seat === seat)![0];
      this.removePlayer(targetId, "kicked", kicker.seat);
      // Then disconnect them: a dropped player's hold ends, a connected one is told why.
      const hold = this.holds.get(targetId);
      if (hold) {
        this.holds.delete(targetId);
        hold.reject(false);
      } else {
        this.clients.find((c) => c.sessionId === targetId)?.leave(CLOSE_CODES.KICKED);
      }
    }),
  };

  /**
   * Starts the game for the seated players (bots included), locks the room and gives the first turn
   * to the host. The one way a game starts.
   */
  private startGame(): void {
    const seats = this.seats();
    this.startBotSeats = this.bots().map((p) => p.seat).sort((a, b) => a - b);
    const dealSeed = this.drawDealSeed();
    const players = [...this.state.players.values()].map(({ seat, name, bot }) => ({ seat, name, bot }));
    const game = startGame(dealSeed, players, this.state.hostSeat);
    const startSeat = this.chooseStartSeat(game.turnSeat);
    this.game = { ...game, turnSeat: startSeat };
    this.state.turn = this.game.turn;
    void this.lock();
    // Locked for players; the room admits spectators itself (through the watch route).
    this.maxClients = MAX_SEATS + MAX_SPECTATORS;
    for (const [id, p] of this.state.players) if (!p.bot && !p.connected) this.startAutoplay(id, "drop");
    log.info("game.started", this.logCtx(undefined, { dealSeed, seats, startSeat }));
    this.setTurn(startSeat);
    this.syncListing({ open: false });
  }

  /**
   * Creates the rematch game with this game's settings: the requester's nickname (they join it
   * first and host it), the same pool, and the bots of the start.
   */
  private async createRematch(nickname: string): Promise<void> {
    const options: JoinOptions = {
      nickname,
      ...(this.pool && { pool: this.pool }),
      botSeats: this.startBotSeats,
    };
    let roomId: string;
    try {
      ({ roomId } = await matchMaker.createRoom("game", options));
    } catch (err) {
      if (err instanceof Error && err.message === "SERVER_FULL") throw new CommandRejection("SERVER_FULL");
      throw err;
    }
    this.state.rematchRoomId = roomId;
    log.info("game.rematch", this.logCtx(undefined, { rematchRoom: roomId }));
  }

  /** True while turns are being played (not in the waiting room, not finished). */
  private running(): boolean {
    return this.state.phase === "play";
  }

  /** The seated people (dropped ones in their hold included). */
  private people(): Player[] {
    return [...this.state.players.values()].filter((p) => !p.bot);
  }

  /** Listing metadata: `extra` fields plus whether a spectator can come in now. */
  private syncListing(extra: Partial<GameMetadata> = {}): void {
    const watchable = this.running() && !this.closing && this.spectators.size < MAX_SPECTATORS;
    void this.setMetadata({ ...this.metadata, ...extra, watchable });
  }

  /** Seats a bot with the first free bot name. */
  private seatBot(seat: number): void {
    const used = new Set(this.bots().map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n))!; // four names for at most three bots
    this.state.players.set(botKey(seat), new Player({ seat, name, bot: true }));
    log.info("bot.added", this.logCtx(undefined, { seat, name }));
    this.syncSeats();
  }

  /** Rejects unless `actor` is the seated host and the game is still in its waiting room. Changes nothing. */
  private requireHostInWaitingRoom(actor: Actor): void {
    const player = this.state.players.get(actor.sessionId);
    if (!player) throw new CommandRejection("NOT_SEATED");
    if (player.seat !== this.state.hostSeat) throw new CommandRejection("NOT_HOST", { seat: player.seat });
    if (this.state.phase !== "waiting") throw new CommandRejection("WRONG_PHASE", { expected: "waiting" });
  }

  /** The player (person or bot) in `seat`, if any. */
  private seatHolder(seat: number): Player | undefined {
    return [...this.state.players.values()].find((p) => p.seat === seat);
  }

  private bots(): Player[] {
    return [...this.state.players.values()].filter((p) => p.bot);
  }

  /**
   * The seats people who are joining right now will get: Colyseus reserves a seat before `onJoin`,
   * which then takes the lowest free one, so with k pending joins the k lowest free seats are spoken for.
   */
  private pendingSeats(): number[] {
    // Colyseus keeps reservations private; entry [3] is true for a dropped player's reconnection.
    const reserved = (this as unknown as { _reservedSeats: Record<string, unknown[]> })._reservedSeats;
    const pending = Object.entries(reserved).filter(([id, seat]) => !seat[3] && !this.state.players.has(id)).length;
    const taken = new Set(this.seats());
    const free = [1, 2, 3, 4].filter((seat) => !taken.has(seat));
    return free.slice(0, pending);
  }

  /**
   * Keeps matchmaking in step with the seats: in the waiting room bots take places people could
   * join (Colyseus locks and unlocks the room by itself as it fills and frees), and the list
   * shows people and bots together.
   */
  private syncSeats(): void {
    if (this.state.phase === "waiting" && !this.closing) this.maxClients = MAX_SEATS - this.bots().length;
    void this.setMetadata({ ...this.metadata, seated: this.state.players.size });
  }

  /** Adds the seat of a seated actor (person or bot), so a game can be followed by seat in the logs. */
  protected logCtx(actor?: Actor, extra?: LogFields): LogFields {
    const seat = actor && this.state.players.get(actor.sessionId)?.seat;
    return super.logCtx(actor, seat ? { seat, ...extra } : extra);
  }

  protected commandStateFacts() {
    return {
      phase: this.state.phase,
      hostSeat: this.state.hostSeat,
      seated: this.state.players.size,
      turnSeat: this.state.turnSeat,
      turnExpired: this.state.turnExpired,
      turn: this.state.turn,
    };
  }

  /** The end of the game (a win, or no person left: winner 0): no further turn, no clock, no joining. */
  private finish(winner: number, reason: FinishReason): void {
    if (this.game) this.game = endGame(this.game, winner);
    this.state.winnerSeat = winner;
    this.setPhase("finished");
    this.restartClock();
    this.clearBotTimer();
    void this.lock();
    this.syncListing();
    log.info("game.finished", this.logCtx(undefined, { winner, reason }));
  }

  /**
   * The one way out of a game (left, kicked, disconnected too long): the seat goes, its cells stay. In
   * the waiting room the seat is simply free again, unless the host went: then the room closes.
   * In a started game the last player standing wins, or the turn passes if it was theirs.
   */
  private removePlayer(sessionId: string, reason: RemovalReason, by?: number): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const { seat } = player;
    this.state.players.delete(sessionId);
    this.autoplay.delete(sessionId);
    log.info("player.removed", this.logCtx(undefined, { player: sessionId, seat, reason, ...(by !== undefined && { by }) }));
    if (this.state.phase === "waiting") {
      if (seat === this.state.hostSeat && !this.closing) this.closeRoom("hostLeft");
      else this.syncSeats();
      return;
    }
    if (this.state.phase === "finished") return;
    this.game = removeSeat(this.game!, seat);
    // Bots never play on alone, only for someone watching; dropped people and spectators in their hold count.
    if (this.nobodyLeft()) this.finish(0, "noPeople");
    else if (this.game.step === "finished") this.finish(this.game.winnerSeat, "lastPlayer");
    else if (this.game.turnSeat !== this.state.turnSeat) this.setTurn(this.game.turnSeat);
    else this.restartClock(true);
  }

  /** No person is seated and nobody watches: bots must not play on. */
  private nobodyLeft(): boolean {
    return this.people().length === 0 && this.spectators.size === 0;
  }

  /** A spectator left, or their hold ran out; a game nobody is left in ends. */
  private removeSpectator(sessionId: string): void {
    if (!this.spectators.delete(sessionId)) return;
    this.state.spectators = this.spectators.size;
    log.info("spectator.left", this.logCtx(undefined, { player: sessionId, spectators: this.spectators.size }));
    this.syncListing();
    if (this.running() && this.nobodyLeft()) this.finish(0, "noPeople");
  }

  /**
   * Ends the game for everyone before it started: nobody can join, every other connection is
   * closed with a code saying why, and dropped players' holds end. Colyseus then disposes the room.
   */
  private closeRoom(reason: CloseReason): void {
    this.closing = true;
    void this.lock();
    this.syncListing({ open: false });
    log.info("room.closed", this.logCtx(undefined, { reason }));
    for (const client of this.clients) client.leave(CLOSE_CODES.HOST_LEFT);
    for (const [sessionId, hold] of this.holds) {
      this.holds.delete(sessionId);
      hold.reject(false);
    }
  }

  /** The taken seats, in ascending order. */
  private seats(): number[] {
    return [...this.state.players.values()].map((p) => p.seat).sort((a, b) => a - b);
  }

  /** The seated player sending a placement; a person whose seat the bot plays may not. Changes nothing. */
  private requirePlaying(actor: Actor): Player {
    const player = this.requireSeated(actor);
    if (player.autoplay && !actor.bot) throw new CommandRejection("AUTOPLAYING", { seat: player.seat });
    return player;
  }

  /**
   * The bot takes over a person's seat (idempotent). A drop does not replace a hand-over, so
   * coming back keeps the autoplay the player chose. On the seat's own turn the bot plays it.
   */
  private startAutoplay(sessionId: string, reason: AutoplayReason): void {
    const player = this.state.players.get(sessionId);
    const had = this.autoplay.get(sessionId);
    if (!player || player.bot || had === "player" || had === reason) return;
    this.autoplay.set(sessionId, reason);
    if (had) return; // a drop's autoplay became the player's own: the bot already plays
    player.autoplay = true;
    log.info("autoplay.changed", this.logCtx(undefined, { seat: player.seat, on: true, reason }));
    if (player.seat === this.state.turnSeat) this.scheduleBotStep(player.seat);
  }

  /** The player takes their seat back, or comes back after a drop (which ends only a drop's autoplay). */
  private stopAutoplay(sessionId: string, reason: "player" | "reconnect"): void {
    const player = this.state.players.get(sessionId);
    const had = this.autoplay.get(sessionId);
    if (!player || !had || (reason === "reconnect" && had !== "drop")) return;
    this.autoplay.delete(sessionId);
    player.autoplay = false;
    log.info("autoplay.changed", this.logCtx(undefined, { seat: player.seat, on: false, reason }));
    if (player.seat === this.state.turnSeat) this.clearBotTimer();
  }

  /** True when the seat is played by the bot: a bot's, or an auto-played person's. */
  private isBotPlayed(seat: number): boolean {
    const holder = this.seatHolder(seat);
    return !!holder && (holder.bot || holder.autoplay);
  }

  /** The actor the bot sends a seat's commands as: the seat's own key, marked as a bot. */
  private botActorOf(seat: number): Actor | undefined {
    const entry = [...this.state.players.entries()].find(([, p]) => p.seat === seat);
    return entry && { sessionId: entry[0], bot: true };
  }

  /** The seated player sending a command; rejects anyone else (spectators too). Changes nothing. */
  private requireSeated(actor: Actor): Player {
    const player = this.state.players.get(actor.sessionId);
    if (!player) throw new CommandRejection("NOT_SEATED");
    return player;
  }

  /**
   * The engine's new state for an accepted placement; its refusal as a rejection with the audit
   * facts. Nobody acts in the waiting room (no game yet).
   */
  private accepted(result: GameCommandResult | undefined, seat: number, cell: Cell): Game {
    if (!result) throw new CommandRejection("WRONG_PHASE", { expected: "play" });
    if (result.ok) return result.state;
    const facts: Partial<Record<typeof result.code, Record<string, unknown>>> = {
      NOT_YOUR_TURN: { seat },
      WRONG_PHASE: { expected: "play" },
      CELL_TAKEN: { cell: [cell.row, cell.col] },
    };
    throw new CommandRejection(result.code, facts[result.code]);
  }

  /** The seat as the engine holds it (seated players are always in the running game). */
  private gameSeat(seat: number): Game["seats"][number] {
    return this.game!.seats.find((s) => s.seat === seat)!;
  }

  /** A new turn starts with a fresh clock; the engine has already moved to it. */
  private setTurn(seat: number): void {
    const from = this.state.turnSeat;
    this.state.turnSeat = seat;
    if (this.state.phase !== "play") this.setPhase("play");
    log.info("turn.changed", this.logCtx(undefined, { from, to: seat }));
    this.restartClock();
    this.clearBotTimer();
    if (this.isBotPlayed(seat)) this.scheduleBotStep(seat);
  }


  /** The bot plays the seat's turn after the usual pause. */
  private scheduleBotStep(seat: number): void {
    this.clearBotTimer();
    if (!this.running()) return;
    this.botTimer = this.clock.setTimeout(() => void this.playBotTurn(seat), this.botDelay(this.botDelayMs));
  }

  /** A bot pause at the current speed. */
  private botDelay(ms: number): number {
    return ms / this.state.botSpeed;
  }

  private clearBotTimer(): void {
    this.botTimer?.clear();
    this.botTimer = undefined;
  }

  /**
   * A bot's turn, through the same command path as a person's. A rejected choice (a bad strategy)
   * falls back to the first empty cell.
   */
  private async playBotTurn(seat: number): Promise<void> {
    this.botTimer = undefined;
    const actor = this.botActorOf(seat);
    // Taken back (or the turn moved on) before the pause ended: nothing to play.
    if (!actor || !this.isBotPlayed(seat) || this.state.turnSeat !== seat || !this.game) return;
    const cell = this.botStrategy(botViewOf(this.game, seat), botRngFor(this.game, seat));
    const result = await this.messages.place(actor, cell);
    if (result.ok || !this.game) return;
    log.error("bot.fallback", this.logCtx(actor, { cmd: "place", code: result.code }));
    const empty = this.game.board.indexOf(0);
    if (empty >= 0) await this.messages.place(actor, cellAt(empty));
  }

  /**
   * Gives the current turn a fresh time limit, or none: in the waiting room, in a finished game, or
   * with nobody on turn. With `keepRunning`, a clock that already runs is left alone; it only stops
   * if it no longer applies.
   */
  private restartClock(keepRunning = false): void {
    const applies = this.running() && this.state.turnSeat !== 0;
    if (keepRunning && applies && this.state.turnDeadline !== 0) return;
    this.turnTimer?.clear();
    this.turnTimer = undefined;
    this.state.turnExpired = false;
    this.state.turnDeadline = 0;
    if (!applies) return;
    this.state.turnDeadline = Date.now() + this.turnLimitMs;
    this.turnTimer = this.clock.setTimeout(() => {
      this.turnTimer = undefined;
      this.state.turnExpired = true;
      log.info("turn.expired", this.logCtx(undefined, { seat: this.state.turnSeat }));
    }, this.turnLimitMs);
  }

  /** The next step within the same turn. */
  private setPhase(phase: TurnPhase): void {
    const from = this.state.phase;
    this.state.phase = phase;
    log.info("phase.changed", this.logCtx(undefined, { from, to: phase, turnSeat: this.state.turnSeat }));
  }

  async onCreate(options?: unknown) {
    // Refuse before anything exists: the creator's own join would be refused anyway.
    const parsed = joinOptionsSchema.safeParse(options);
    if (!parsed.success) {
      const reason = refusalOf(parsed.error);
      log.info("room.refused", { reason });
      throw refuse(reason === "nickname" ? "INVALID_NICKNAME" : "INVALID_OPTIONS");
    }
    // A spectator of a running game joins, never creates (games of bots to watch run on the device).
    if (parsed.data.watch) {
      log.info("room.refused", { reason: "options" });
      throw refuse("INVALID_OPTIONS");
    }
    if (GameRoom.openGames >= GameRoom.maxOpenGames) {
      log.warn("room.refused", { reason: "cap", open: GameRoom.openGames });
      throw refuse("SERVER_FULL");
    }
    GameRoom.openGames++;
    this.counted = true;

    await super.onCreate(options);
    const { data } = parsed;
    this.pool = data.pool ?? "";
    await this.setMetadata({ host: "", open: true, pool: data.pool ?? "", seated: 0, watchable: false });
    this.state.cells.push(...Array.from({ length: CELL_COUNT }, () => 0));
    // A rematch keeps the finished game's bots in their seats.
    for (const seat of data.botSeats ?? []) this.seatBot(seat);
  }

  /** Checks the join options before a seat is taken: a player needs a valid nickname (and valid options). */
  onAuth(_client: Client, options: unknown): JoinOptions {
    const parsed = joinOptionsSchema.safeParse(options);
    if (!parsed.success) {
      const reason = refusalOf(parsed.error);
      log.info("room.refused", this.logCtx(undefined, { reason }));
      throw refuse(reason === "nickname" ? "INVALID_NICKNAME" : "INVALID_OPTIONS");
    }
    return parsed.data;
  }

  /** The lowest seat 1–4 nobody holds (dropped players keep theirs). */
  private freeSeat(): number {
    const taken = new Set([...this.state.players.values()].map((p) => p.seat));
    for (let seat = 1; seat <= MAX_SEATS; seat++) if (!taken.has(seat)) return seat;
    throw new Error("No free seat"); // maxClients prevents this
  }

  /** Seats the player in the waiting room (joining is closed once the game starts); the first one hosts. */
  onJoin(client: Client, _options?: unknown, auth?: JoinOptions) {
    const name = auth!.nickname;
    if (auth!.watch) {
      this.addSpectator(client, name);
      return;
    }
    super.onJoin(client, undefined, undefined, { name });
    const seat = this.freeSeat();
    this.state.players.set(client.sessionId, new Player({ seat, name }));
    if (this.state.hostSeat === 0) {
      this.state.hostSeat = seat;
      void this.setMetadata({ ...this.metadata, host: name });
    }
    this.syncSeats();
  }

  /**
   * A spectator comes in while the game runs and has room. Anything else is refused (a race with
   * the watch route).
   */
  private addSpectator(client: Client, name: string): void {
    if (!(this.running() && this.spectators.size < MAX_SPECTATORS)) {
      log.info("room.refused", this.logCtx(client, { reason: "notWatchable" }));
      throw refuse("NOT_WATCHABLE");
    }
    super.onJoin(client, undefined, undefined, { name, spectator: true });
    this.spectators.add(client.sessionId);
    this.state.spectators = this.spectators.size;
    log.info("spectator.joined", this.logCtx(client, { spectators: this.spectators.size }));
    this.syncListing();
  }

  /** Consented leave, or a dropped player's hold ran out (a kicked player is already gone). */
  onLeave(client: Client, code?: CloseCode) {
    super.onLeave(client, code);
    this.holds.delete(client.sessionId);
    if (this.spectators.has(client.sessionId)) {
      this.removeSpectator(client.sessionId);
      return;
    }
    const player = this.state.players.get(client.sessionId);
    if (player) this.removePlayer(client.sessionId, player.connected ? "left" : "timeout");
  }

  /**
   * Unintended disconnect (mobile screen off, network switch): hold the seat so
   * the SDK can reconnect into the same session.
   */
  onDrop(client: Client, code?: CloseCode) {
    if (this.spectators.has(client.sessionId)) {
      if (!this.closing) this.holds.set(client.sessionId, this.holdSeat(client, code, this.disconnectLimitSeconds));
      return;
    }
    const player = this.state.players.get(client.sessionId);
    // Already removed (kicked), or the room is closing: nothing to hold; onLeave follows.
    if (!player || this.closing) return;
    player.connected = false;
    this.holds.set(client.sessionId, this.holdSeat(client, code, this.disconnectLimitSeconds));
    if (this.running()) this.startAutoplay(client.sessionId, "drop");
  }

  onReconnect(client: Client) {
    super.onReconnect(client);
    this.holds.delete(client.sessionId);
    if (this.spectators.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = true;
      this.stopAutoplay(client.sessionId, "reconnect");
    }
  }

  onDispose() {
    super.onDispose();
    this.turnTimer?.clear();
    this.clearBotTimer();
    if (this.counted) GameRoom.openGames--;
  }
}
