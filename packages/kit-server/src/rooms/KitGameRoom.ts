import { randomInt } from "node:crypto";
import type { Schema } from "@colyseus/schema";
import { ErrorCode, matchMaker, ServerError, type Client, type CloseCode, type Deferred } from "colyseus";
import {
  autoplayPayloadSchema,
  BOT_NAMES,
  botMovePayloadSchema,
  botSeatPayloadSchema,
  CLOSE_CODES,
  DISCONNECT_LIMIT_SECONDS,
  joinOptionsSchema,
  kickPayloadSchema,
  kickRejection,
  MAX_GAME_SEED,
  MAX_SEATS,
  MAX_SPECTATORS,
  movePayloadSchema,
  optionsPayloadSchema,
  rematchPayloadSchema,
  speedPayloadSchema,
  startPayloadSchema,
  TURN_TIME_LIMIT_SECONDS,
  type GameMetadata,
  type GameRules,
  type JoinErrorCode,
  type JoinOptions,
  type TurnPhase,
} from "@game-kit/protocol";
import type { z } from "zod";
import { log, type LogFields } from "../logging/logger.js";
import { CommandRejection, type Actor } from "./command.js";
import type { GameServerDefinition } from "./definition.js";
import { LoggedRoom } from "./LoggedRoom.js";
import { lobbyStateOf, Player, type LobbyState } from "./LobbyState.js";

/** At most this many games exist at a time (one 0 € instance); creating more is refused. */
export const MAX_OPEN_GAMES = 100;

/** Default pause before a bot's turn, so people can follow it. */
export const BOT_DELAY_MS = 1000;

/** How long after the pause the server waits for the bot runner's move before playing one itself. */
export const BOT_RUNNER_GRACE_MS = 10_000;

/** Why the room was closed for everyone (`room.closed`). */
type CloseReason = "hostLeft";

/** Why a player was taken out of the game (`player.removed`). */
type RemovalReason = "left" | "kicked" | "timeout";

/** Why a person's seat is auto-played: they handed it over, or their connection dropped. */
type AutoplayReason = "player" | "drop";

/** Why a started game ended (`game.finished`). */
type FinishReason = "complete" | "lastPlayer" | "noPeople";

/** Why the server played a bot's move itself (`bot.fallback`). */
type FallbackReason = "noRunner" | "runnerSilent";

/** A bot's key in `state.players`; it can never clash with a Colyseus sessionId. */
const botKey = (seat: number) => `bot:${seat}`;

/** Refuses a join or room creation: the client reads `code` from the error message. */
const refuse = (code: JoinErrorCode) =>
  new ServerError(code === "INVALID_NICKNAME" ? ErrorCode.AUTH_FAILED : ErrorCode.APPLICATION_ERROR, code);

/** Why join options were refused: the nickname, or any other field (`bots`, `pool` …). */
const refusalOf = (error: z.ZodError): "nickname" | "options" =>
  error.issues.some((issue) => issue.path[0] === "nickname") ? "nickname" : "options";

/**
 * One game of a kit game: up to `MAX_SEATS` seated players (people and bots) and spectators. It
 * starts in the waiting room, where players take seats; the host (the first to join) starts the
 * game. Everything game-specific comes from the definition; a game's room extends this class and
 * passes its definition (and may add its own commands to `messages` with the protected helpers).
 */
export class KitGameRoom<G, M, O, C extends Schema> extends LoggedRoom<{ state: LobbyState<C>; metadata: GameMetadata<O> }> {
  maxClients = MAX_SEATS;
  state: LobbyState<C>;

  /** Games that exist now, across all rooms of this class in this process. */
  static openGames = 0;
  /** The cap on `openGames`; room tests lower it. */
  static maxOpenGames = MAX_OPEN_GAMES;

  /** Turn time limit; room tests shorten it. */
  turnLimitMs = TURN_TIME_LIMIT_SECONDS * 1000;
  /** How long a dropped player keeps their seat; room tests shorten it. */
  disconnectLimitSeconds = DISCONNECT_LIMIT_SECONDS;

  /** Draws the game's seed at the start; room tests replace it. */
  drawDealSeed = () => randomInt(0, MAX_GAME_SEED + 1);
  /** Adjusts the new game before the first turn; room tests replace it to start elsewhere. */
  adjustStart = (game: G): G => game;

  /** Pause before a bot's turn; room tests shorten it. */
  botDelayMs = BOT_DELAY_MS;
  /** How long the bot runner has after the pause before the server moves itself; room tests shorten it. */
  botRunnerGraceMs = BOT_RUNNER_GRACE_MS;

  protected readonly rules: GameRules<G, M, O>;
  /** The game's options (e.g. its variant); the host may change them in the waiting room. */
  private opts: O;
  /**
   * The started game as the rules hold it (the one source of the rules' truth); the synced state
   * mirrors it. Undefined in the waiting room.
   */
  private current?: G;
  /** The facts that identify the turn now (see `setTurn`). */
  private turnKey = "";
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

  messages: ReturnType<KitGameRoom<G, M, O, C>["kitMessages"]>;

  constructor(protected readonly definition: GameServerDefinition<G, M, O, C>) {
    super();
    this.rules = definition.rules;
    this.opts = definition.defaultOptions;
    const State = lobbyStateOf(definition.Child);
    this.state = new State() as unknown as LobbyState<C>;
    this.messages = this.kitMessages();
  }

  /** The kit's commands; a game's room may spread them into its own `messages`. */
  protected kitMessages() {
    const { moveSchema, optionsSchema } = this.definition;
    return {
      start: this.command("start", startPayloadSchema, (client) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) throw new CommandRejection("NOT_SEATED");
        if (player.seat !== this.state.hostSeat) throw new CommandRejection("NOT_HOST", { seat: player.seat });
        if (this.state.phase !== "waiting") throw new CommandRejection("WRONG_PHASE", { expected: "waiting" });
        const needed = this.rules.seatRange(this.opts).min;
        if (this.state.players.size < needed) throw new CommandRejection("NOT_ENOUGH_PLAYERS", { seated: this.state.players.size, needed });
        this.startGame();
      }),

      setOptions: this.command("setOptions", optionsPayloadSchema(optionsSchema), (client, { options }) => {
        this.requireHostInWaitingRoom(client);
        const to = options as O;
        const { max } = this.rules.seatRange(to);
        const people = this.people();
        const joining = this.pendingSeats().length;
        if (people.length + joining > max || people.some((p) => p.seat > max)) {
          throw new CommandRejection("TOO_MANY_PLAYERS", { ...to, people: people.length + joining });
        }
        this.definition.optionsChange?.(this.opts, to);
        this.applyOptions(to);
      }),

      addBot: this.command("addBot", botSeatPayloadSchema, (client, { seat }) => {
        this.requireHostInWaitingRoom(client);
        if (seat > this.maxSeats() || this.seatHolder(seat) || this.pendingSeats().includes(seat)) {
          throw new CommandRejection("SEAT_TAKEN", { seat });
        }
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

      move: this.command("move", movePayloadSchema(moveSchema), (client, { move }) => {
        const player = this.requirePlaying(client);
        this.playFor(player.seat, move as M);
      }),

      /** The bot runner's move for a bot-played seat on turn; validated like any move. */
      botMove: this.command("botMove", botMovePayloadSchema(moveSchema), (client, { seat, move }) => {
        const sender = this.requireSeated(client);
        if (!this.running()) throw new CommandRejection("WRONG_PHASE", { expected: "play" });
        if (sender.seat !== this.state.botRunnerSeat) throw new CommandRejection("NOT_BOT_RUNNER", { runner: this.state.botRunnerSeat });
        if (!this.isBotPlayed(seat)) throw new CommandRejection("NOT_BOT_SEAT", { seat });
        if (seat !== this.state.turnSeat) throw new CommandRejection("NOT_YOUR_TURN", { seat });
        this.playFor(seat, move as M);
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
  }

  /** The game's options now. */
  protected options(): O {
    return this.opts;
  }

  /** The started game; undefined in the waiting room. */
  protected game(): G | undefined {
    return this.current;
  }

  /**
   * Starts the game for the seated players (bots included), locks the room and gives the first turn
   * to the seat the rules choose. The one way a game starts.
   */
  private startGame(): void {
    const seats = this.seats();
    this.startBotSeats = this.bots().map((p) => p.seat).sort((a, b) => a - b);
    const dealSeed = this.drawDealSeed();
    const players = [...this.state.players.values()].map(({ seat, name, bot }) => ({ seat, name, bot })).sort((a, b) => a.seat - b.seat);
    this.current = this.adjustStart(this.rules.start(dealSeed, players, this.opts));
    const startSeat = this.rules.seatOnTurn(this.current);
    this.syncGame();
    void this.lock();
    // Locked for players; the room admits spectators itself (through the watch route).
    this.maxClients = MAX_SEATS + MAX_SPECTATORS;
    this.syncRunner();
    for (const [id, p] of this.state.players) if (!p.bot && !p.connected) this.startAutoplay(id, "drop");
    const facts = { dealSeed, ...this.opts, seats, startSeat, ...this.rules.turnFacts(this.current), runner: this.state.botRunnerSeat };
    log.info("game.started", this.logCtx(undefined, facts));
    this.setTurn();
    this.syncListing({ open: false });
  }

  /** `seat` moves (a person, the runner for a bot, or the server's fallback): the rules decide, then state and turn follow. */
  private playFor(seat: number, move: M): void {
    // Nobody acts in the waiting room (no game yet).
    if (!this.current) throw new CommandRejection("WRONG_PHASE", { expected: "play" });
    const result = this.rules.play(this.current, seat, move);
    if (!result.ok) throw new CommandRejection(result.code, result.facts ?? { seat, move: this.rules.moveText(move) });
    this.current = result.game;
    this.syncGame();
    if (this.rules.isOver(this.current)) this.finish(this.rules.winners(this.current), "complete");
    else this.setTurn();
  }

  /** The most seats the options take. */
  private maxSeats(): number {
    return this.rules.seatRange(this.opts).max;
  }

  /**
   * Switches the waiting room to `options`: bots on seats beyond the new seat range go, the game
   * child is reset, and matchmaking and the listing follow. People were checked first.
   */
  private applyOptions(options: O): void {
    const from = this.opts;
    this.opts = options;
    const max = this.maxSeats();
    for (const bot of this.bots()) {
      if (bot.seat <= max) continue;
      this.state.players.delete(botKey(bot.seat));
      log.info("bot.removed", this.logCtx(undefined, { seat: bot.seat, name: bot.name, reason: "options" }));
    }
    this.definition.reset(options, this.state.game);
    log.info("options.changed", this.logCtx(undefined, { from, to: options }));
    void this.setMetadata({ ...this.metadata, options });
    this.syncSeats();
  }

  /** Mirrors the rules' game into the synced child. */
  private syncGame(): void {
    this.definition.sync(this.current!, this.state.game);
  }

  /**
   * The bot runner is the host while seated and connected, else the connected person in the lowest
   * seat, else nobody (the server plays the bots). A change during a bot's turn restarts its timer.
   */
  private syncRunner(): void {
    const connected = this.people()
      .filter((p) => p.connected)
      .sort((a, b) => a.seat - b.seat);
    const runner = connected.find((p) => p.seat === this.state.hostSeat) ?? connected[0];
    const seat = runner?.seat ?? 0;
    const from = this.state.botRunnerSeat;
    if (seat === from) return;
    this.state.botRunnerSeat = seat;
    if (!this.running()) return;
    log.info("bot.runner", this.logCtx(undefined, { from, to: seat }));
    if (this.isBotPlayed(this.state.turnSeat)) this.scheduleBotStep(this.state.turnSeat);
  }

  /**
   * Creates the rematch game with this game's settings: the requester's nickname (they join it
   * first and host it), the same pool, options and the bots of the start.
   */
  private async createRematch(nickname: string): Promise<void> {
    const options: JoinOptions<O> = {
      nickname,
      ...(this.pool && { pool: this.pool }),
      botSeats: this.startBotSeats,
      options: this.opts,
    };
    let roomId: string;
    try {
      ({ roomId } = await matchMaker.createRoom(this.roomName, options));
    } catch (err) {
      if (err instanceof Error && err.message === "SERVER_FULL") throw new CommandRejection("SERVER_FULL");
      throw err;
    }
    this.state.rematchRoomId = roomId;
    log.info("game.rematch", this.logCtx(undefined, { rematchRoom: roomId }));
  }

  /** True while turns are being played (not in the waiting room, not finished). */
  protected running(): boolean {
    return this.state.phase === "play";
  }

  /** The seated people (dropped ones in their hold included). */
  protected people(): Player[] {
    return [...this.state.players.values()].filter((p) => !p.bot);
  }

  /** Listing metadata: `extra` fields plus whether a spectator can come in now. */
  private syncListing(extra: Partial<GameMetadata<O>> = {}): void {
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
  protected requireHostInWaitingRoom(actor: Actor): void {
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
    const free = this.seatNumbers().filter((seat) => !taken.has(seat));
    return free.slice(0, pending);
  }

  /**
   * Keeps matchmaking in step with the seats: in the waiting room bots take places people could
   * join (Colyseus locks and unlocks the room by itself as it fills and frees), and the list
   * shows people and bots together.
   */
  private syncSeats(): void {
    if (this.state.phase === "waiting" && !this.closing) this.maxClients = Math.max(0, this.maxSeats() - this.bots().length);
    void this.setMetadata({ ...this.metadata, seated: this.state.players.size });
    this.syncRunner();
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
      ...this.definition.stateFacts?.(this.state.game),
      turnExpired: this.state.turnExpired,
      turn: this.state.turn,
      runner: this.state.botRunnerSeat,
    };
  }

  /** The end of the game (winners by the rules, or none: no person left): no further turn, no clock, no joining. */
  private finish(winners: readonly number[], reason: FinishReason): void {
    if (this.current) {
      this.current = this.rules.end(this.current);
      this.syncGame();
    }
    this.state.winners.push(...winners);
    this.setPhase("finished");
    this.restartClock();
    this.clearBotTimer();
    void this.lock();
    this.syncListing();
    const facts = this.current ? this.rules.finishFacts(this.current) : {};
    log.info("game.finished", this.logCtx(undefined, { winners: [...winners], reason, ...facts }));
  }

  /**
   * The one way out of a game (left, kicked, disconnected too long): the seat goes, the game decides
   * what happens to its things. In the waiting room the seat is simply free again, unless the host
   * went: then the room closes. In a started game the rules may end it, or the turn passes if it was theirs.
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
    this.current = this.rules.removeSeat(this.current!, seat);
    this.syncGame();
    this.syncRunner();
    // Bots never play on alone, only for someone watching; dropped people and spectators in their hold count.
    if (this.nobodyLeft()) this.finish([], "noPeople");
    else if (this.rules.isOver(this.current)) this.finish(this.rules.winners(this.current), this.state.players.size === 1 ? "lastPlayer" : "complete");
    // A new turn when the turn moved on, or someone else now plays it (e.g. a shared colour).
    else if (this.currentTurnKey() !== this.turnKey || this.rules.seatOnTurn(this.current) !== this.state.turnSeat) this.setTurn();
    else this.restartClock(true);
  }

  /** What identifies the turn now: the rules' turn facts. */
  private currentTurnKey(): string {
    return JSON.stringify(this.rules.turnFacts(this.current!));
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
    if (this.running() && this.nobodyLeft()) this.finish([], "noPeople");
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

  /** The seated player sending a move; a person whose seat the bot plays may not. Changes nothing. */
  protected requirePlaying(actor: Actor): Player {
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
  protected requireSeated(actor: Actor): Player {
    const player = this.state.players.get(actor.sessionId);
    if (!player) throw new CommandRejection("NOT_SEATED");
    return player;
  }

  /** A new turn starts with a fresh clock; the rules have already moved to it. */
  private setTurn(): void {
    const from = this.state.turnSeat;
    const game = this.current!;
    const seat = this.rules.seatOnTurn(game);
    this.state.turnSeat = seat;
    this.turnKey = this.currentTurnKey();
    this.state.turn++;
    if (this.state.phase !== "play") this.setPhase("play");
    log.info("turn.changed", this.logCtx(undefined, { from, to: seat, ...this.rules.turnFacts(game), ...this.definition.turnLogFacts?.(game) }));
    this.restartClock();
    this.clearBotTimer();
    if (this.isBotPlayed(seat)) this.scheduleBotStep(seat);
  }

  /**
   * A bot-played seat's turn: the runner sends its move. The server moves itself after the pause
   * when there is no runner, or when the runner has not moved within the grace time after it.
   */
  private scheduleBotStep(seat: number): void {
    this.clearBotTimer();
    if (!this.running()) return;
    const runner = this.state.botRunnerSeat;
    const wait = this.botDelay(this.botDelayMs) + (runner ? this.botRunnerGraceMs : 0);
    this.botTimer = this.clock.setTimeout(() => void this.playFallback(seat, runner ? "runnerSilent" : "noRunner"), wait);
  }

  /** A bot pause at the current speed. */
  private botDelay(ms: number): number {
    return ms / this.state.botSpeed;
  }

  private clearBotTimer(): void {
    this.botTimer?.clear();
    this.botTimer = undefined;
  }

  /** The server plays the rules' simple bot move for the seat, through the same command path as anyone. */
  private async playFallback(seat: number, reason: FallbackReason): Promise<void> {
    this.botTimer = undefined;
    const actor = this.botActorOf(seat);
    // Taken back (or the turn moved on) before the timer ran out: nothing to play.
    if (!actor || !this.isBotPlayed(seat) || this.state.turnSeat !== seat || !this.current) return;
    const move = this.rules.fallbackMove(this.current);
    const fields = this.logCtx(actor, { seat, ...this.rules.turnFacts(this.current), reason, runner: this.state.botRunnerSeat });
    if (reason === "runnerSilent") log.warn("bot.fallback", fields);
    else log.info("bot.fallback", fields);
    // The rules never hand the turn to a seat that cannot move.
    if (move !== undefined) await this.messages.move(actor, { move });
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
    const options = phase === "play" ? this.opts : {};
    log.info("phase.changed", this.logCtx(undefined, { from, to: phase, turnSeat: this.state.turnSeat, ...options }));
  }

  /** The join options with the game's options schema. */
  private joinSchema() {
    return joinOptionsSchema(this.definition.optionsSchema);
  }

  /** The room class, whose statics count the open games. */
  private roomClass(): typeof KitGameRoom {
    return this.constructor as typeof KitGameRoom;
  }

  async onCreate(options?: unknown) {
    // Refuse before anything exists: the creator's own join would be refused anyway.
    const parsed = this.joinSchema().safeParse(options);
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
    const cls = this.roomClass();
    if (cls.openGames >= cls.maxOpenGames) {
      log.warn("room.refused", { reason: "cap", open: cls.openGames });
      throw refuse("SERVER_FULL");
    }
    cls.openGames++;
    this.counted = true;

    await super.onCreate(options);
    const { data } = parsed;
    this.pool = data.pool ?? "";
    this.opts = { ...this.definition.defaultOptions, ...(data.options as O | undefined) };
    await this.setMetadata({ host: "", open: true, pool: data.pool ?? "", seated: 0, watchable: false, options: this.opts });
    this.definition.reset(this.opts, this.state.game);
    const max = this.maxSeats();
    this.maxClients = max;
    // A rematch keeps the finished game's options and bots in their seats.
    for (const seat of data.botSeats ?? []) if (seat <= max) this.seatBot(seat);
  }

  /** Checks the join options before a seat is taken: a player needs a valid nickname (and valid options). */
  onAuth(_client: Client, options: unknown): JoinOptions<O> {
    const parsed = this.joinSchema().safeParse(options);
    if (!parsed.success) {
      const reason = refusalOf(parsed.error);
      log.info("room.refused", this.logCtx(undefined, { reason }));
      throw refuse(reason === "nickname" ? "INVALID_NICKNAME" : "INVALID_OPTIONS");
    }
    return parsed.data as JoinOptions<O>;
  }

  /** Seats 1 up to the options' most. */
  private seatNumbers(): number[] {
    return Array.from({ length: this.maxSeats() }, (_, i) => i + 1);
  }

  /** The lowest seat nobody holds (dropped players keep theirs). */
  private freeSeat(): number {
    const taken = new Set([...this.state.players.values()].map((p) => p.seat));
    for (const seat of this.seatNumbers()) if (!taken.has(seat)) return seat;
    throw new Error("No free seat"); // maxClients prevents this
  }

  /** Seats the player in the waiting room (joining is closed once the game starts); the first one hosts. */
  onJoin(client: Client, _options?: unknown, auth?: JoinOptions<O>) {
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
    this.syncRunner();
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
      this.syncRunner();
      this.stopAutoplay(client.sessionId, "reconnect");
    }
  }

  onDispose() {
    super.onDispose();
    this.turnTimer?.clear();
    this.clearBotTimer();
    if (this.counted) this.roomClass().openGames--;
  }
}
