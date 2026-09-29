import { BOT_NAMES, BOT_SPEEDS, type BotSpeed, type CommandResult } from "@palikka/protocol";
import { botRng, botSeed, MAX_SEED, playMove, simpleBotMove, startGame, type Game, type GameResult, type GameSeat, type Placement, type Position } from "@palikka/rules";
import { BOT_DELAY_MS, botBudget, type AskBot } from "../bots/botMoves.ts";
import { askBotWorker } from "../bots/botWorkerClient.ts";
import { log } from "../logging/logger.ts";
import {
  clearLocalGame,
  isWatchRoomId,
  loadLocalGame,
  localToken,
  newLocalRoomId,
  saveLocalGame,
  WATCH_ROOM_PREFIX,
  type SavedLocalGame,
} from "./localGameStore.ts";
import type { GameRoomLike } from "./useGameSession.ts";
import type { SyncedPlayer, SyncedState } from "./viewModel.ts";

export { BOT_DELAY_MS };

/** The player's key in the synced players (their session id). */
const ME = "me";
/** The bot acting for the player while their seat is handed over. */
const BOT_FOR_ME = "bot:me";

export interface LocalRoomDeps {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  /** A fresh game seed. */
  seed(): number;
  /** Where bot moves come from: the bot worker in the app, a stub in tests. */
  askBot: AskBot;
}

const defaultDeps = (): LocalRoomDeps => ({
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  seed: () => {
    const [value] = globalThis.crypto.getRandomValues(new Uint32Array(1));
    return value! % (MAX_SEED + 1);
  },
  askBot: askBotWorker,
});

/** The seats of a quick game: the player in seat 1, `bots` bots in the next seats. */
function quickSeats(nickname: string, bots: number): GameSeat[] {
  return [{ seat: 1, name: nickname, bot: false }, ...BOT_NAMES.slice(0, bots).map((name, i) => ({ seat: i + 2, name, bot: true }))];
}

function logStarted(roomId: string, game: Game, watch = false): void {
  log.info("client.local.started", {
    room: roomId,
    dealSeed: game.seed,
    seats: game.seats.map((s) => s.seat).join(","),
    startSeat: game.position.turn,
    ...(watch && { watch: true }),
  });
}

/** A new saved game against `bots` bots, replacing any saved one; logs its start. */
function newGame(nickname: string, bots: number, deps: LocalRoomDeps): SavedLocalGame {
  const roomId = newLocalRoomId();
  // The player sits in seat 1, so they move first.
  const game = startGame(deps.seed(), quickSeats(nickname, bots));
  const saved = { roomId, game };
  saveLocalGame(saved);
  logStarted(roomId, game);
  return saved;
}

/** A game of `bots` bots only to watch, in seats 1 upwards. Never saved. */
function newWatchGame(bots: number, speed: BotSpeed, deps: LocalRoomDeps): SavedLocalGame {
  const roomId = newLocalRoomId(Math.random, WATCH_ROOM_PREFIX);
  const game = startGame(
    deps.seed(),
    BOT_NAMES.slice(0, bots).map((name, i) => ({ seat: i + 1, name, bot: true })),
  );
  logStarted(roomId, game, true);
  return { roomId, game, speed };
}

/** The `place` payload as a placement; undefined when a field is missing or not an integer. */
function placementOf(payload: unknown): Placement | undefined {
  const { piece, orientation, row, col } = (payload ?? {}) as Record<string, unknown>;
  const fields = [piece, orientation, row, col];
  return fields.every((f) => Number.isInteger(f)) ? { piece, orientation, row, col } as Placement : undefined;
}

/**
 * A game against bots that runs on this device, behind the same interface as a game room on the
 * server: the session, view model and screens cannot tell the difference. Commands answer like the
 * server; bots play through the same path after the server's pause, their moves computed off the UI
 * thread; every step is saved. "Peru" takes back the player's last move and the bots' after it.
 */
export class LocalRoom implements GameRoomLike {
  readonly roomId: string;
  readonly sessionId = ME;
  readonly reconnectionToken: string;
  private saved: SavedLocalGame;
  private readonly deps: LocalRoomDeps;
  private stateListeners: ((state: SyncedState) => void)[] = [];
  private leaveListeners: ((code: number) => void)[] = [];
  private botTimer: unknown;
  /** Bumped whenever a pending bot move becomes stale (a new state, an undo, a leave). */
  private generation = 0;
  private gone = false;

  private constructor(saved: SavedLocalGame, deps: LocalRoomDeps) {
    this.saved = saved;
    this.deps = deps;
    this.roomId = saved.roomId;
    this.reconnectionToken = localToken(saved.roomId);
    if (!this.watching) saveLocalGame(saved);
    this.scheduleBot();
  }

  /** Starts a new game against `bots` bots (1–3) and saves it, replacing any saved one. */
  static create(nickname: string, bots: number, deps: Partial<LocalRoomDeps> = {}): LocalRoom {
    const all = { ...defaultDeps(), ...deps };
    return new LocalRoom(newGame(nickname, bots, all), all);
  }

  /** Starts a game of `bots` bots (2–4) to watch at `speed`; it is never saved. */
  static createWatch(bots: number, speed: BotSpeed = 1, deps: Partial<LocalRoomDeps> = {}): LocalRoom {
    const all = { ...defaultDeps(), ...deps };
    return new LocalRoom(newWatchGame(bots, speed, all), all);
  }

  /** The saved game `roomId`, continued where it was; undefined when it is gone. */
  static restore(roomId: string, deps: Partial<LocalRoomDeps> = {}): LocalRoom | undefined {
    const saved = loadLocalGame(roomId);
    return saved && new LocalRoom(saved, { ...defaultDeps(), ...deps });
  }

  get game(): Game {
    return this.saved.game;
  }

  /** The game in the shape the server syncs, as seen by the player. */
  get state(): SyncedState {
    const { game, rematchRoomId } = this.saved;
    const { position } = game;
    const players = new Map<string, SyncedPlayer>(
      game.seats.map((s) => [
        s.bot ? `bot:${s.seat}` : ME,
        { seat: s.seat, name: s.name, bot: s.bot, ...(!s.bot && { autoplay: this.saved.autoplay ?? false }), connected: true },
      ]),
    );
    return {
      cells: position.cells,
      colours: position.colours.map((colour) => ({
        colour,
        pieces: position.placed[colour] ?? [],
        out: position.out.includes(colour),
        left: game.left.includes(colour),
      })),
      players,
      turnSeat: position.turn,
      phase: position.ended ? "finished" : "play",
      hostSeat: 1,
      winners: game.winners,
      turn: position.moveNumber + 1,
      turnDeadline: 0,
      turnExpired: false,
      botRunnerSeat: 0,
      spectators: 0,
      botSpeed: this.saved.speed ?? 1,
      rematchRoomId: rematchRoomId ?? "",
      undo: !this.watching,
      undoable: !position.ended && (this.saved.history?.length ?? 0) > 0,
    };
  }

  onStateChange(cb: (state: SyncedState) => void): void {
    this.stateListeners.push(cb);
  }

  onLeave(cb: (code: number) => void): void {
    this.leaveListeners.push(cb);
  }

  onDrop(): void {
    // A game on the device never loses its connection.
  }

  onReconnect(): void {
    // Nor reconnects.
  }

  removeAllListeners(): void {
    this.stateListeners = [];
    this.leaveListeners = [];
  }

  request(type: string, payload: unknown): Promise<CommandResult> {
    return Promise.resolve(this.handle(type, payload, ME));
  }

  /** Leaving on purpose: the game is over and forgotten. */
  leave(): Promise<void> {
    if (!this.gone) {
      this.gone = true;
      this.clearBotTimer();
      if (!this.game.position.ended) this.logFinished();
      if (!this.watching) clearLocalGame(this.roomId);
    }
    return Promise.resolve();
  }

  /** A game of bots only that the viewer watches. */
  private get watching(): boolean {
    return isWatchRoomId(this.roomId);
  }

  private handle(type: string, payload: unknown, actor: string): CommandResult {
    if (this.gone) return { ok: false, code: "WRONG_PHASE" };
    // The spectator of a game of bots has no seat: only the speed is theirs.
    if (this.watching && actor === ME) return type === "setSpeed" ? this.setSpeed(payload) : { ok: false, code: "NOT_SEATED" };
    const seat = actor === ME || actor === BOT_FOR_ME ? 1 : Number(actor.slice("bot:".length));
    switch (type) {
      case "place": {
        if (actor === ME && this.saved.autoplay) return { ok: false, code: "AUTOPLAYING" };
        const move = placementOf(payload);
        if (!move) return { ok: false, code: "INVALID_COMMAND" };
        const before = this.game;
        const result = playMove(before, seat, move);
        // The state before each of the player's own moves, for "Peru".
        const history = result.ok && actor === ME ? [...(this.saved.history ?? []), before] : this.saved.history;
        return this.apply(result, history);
      }
      case "undo":
        return this.undo();
      case "setAutoplay":
        return this.setAutoplay(payload);
      case "rematch":
        return this.rematch();
      case "setSpeed":
        return { ok: false, code: "NOT_SPECTATOR" };
      default:
        // Waiting-room and kick commands have nothing to act on here.
        return { ok: false, code: "WRONG_PHASE" };
    }
  }

  private apply(result: GameResult, history: Game[] | undefined): CommandResult {
    if (!result.ok) return result;
    const finishing = result.game.position.ended && !this.game.position.ended;
    this.update({ ...this.saved, game: result.game, ...(history && { history }) });
    if (finishing) this.logFinished();
    return { ok: true };
  }

  /** The bot takes over the player's seat or gives it back; on the player's turn it plays it. */
  private setAutoplay(payload: unknown): CommandResult {
    const { on } = (payload ?? {}) as { on?: unknown };
    if (typeof on !== "boolean") return { ok: false, code: "INVALID_COMMAND" };
    if (this.game.position.ended) return { ok: false, code: "WRONG_PHASE" };
    if ((this.saved.autoplay ?? false) === on) return { ok: true };
    this.update({ ...this.saved, autoplay: on });
    return { ok: true };
  }

  /** A game of bots to watch: every pause of a bot's turn is divided by the speed. */
  private setSpeed(payload: unknown): CommandResult {
    const { speed } = (payload ?? {}) as { speed?: unknown };
    if (!BOT_SPEEDS.includes(speed as BotSpeed)) return { ok: false, code: "INVALID_COMMAND" };
    if (this.game.position.ended) return { ok: false, code: "WRONG_PHASE" };
    this.saved = { ...this.saved, speed: speed as BotSpeed };
    this.emit();
    return { ok: true };
  }

  /** "Peru": back to the game before the player's last move (the bots' moves after it go too). */
  private undo(): CommandResult {
    const history = this.saved.history ?? [];
    const last = history.at(-1);
    if (this.watching || !last || this.game.position.ended) return { ok: false, code: "WRONG_PHASE" };
    this.update({ ...this.saved, game: last, history: history.slice(0, -1) });
    return { ok: true };
  }

  /** Creates the next game with the same seats and syncs its id; the session then moves there. */
  private rematch(): CommandResult {
    if (!this.game.position.ended) return { ok: false, code: "WRONG_PHASE" };
    if (this.saved.rematchRoomId) return { ok: true };
    const next = newGame(
      this.game.seats.find((s) => !s.bot)!.name,
      this.game.seats.filter((s) => s.bot).length,
      this.deps,
    );
    // The new game is the saved one now (the session opens it by its id); this one only remembers where it went.
    this.saved = { ...this.saved, rematchRoomId: next.roomId };
    this.emit();
    return { ok: true };
  }

  /** Saves and publishes a new state, then lets a bot on turn play. */
  private update(saved: SavedLocalGame): void {
    this.saved = saved;
    if (!this.watching) saveLocalGame(saved);
    this.emit();
    this.scheduleBot();
  }

  private emit(): void {
    const state = this.state;
    for (const cb of [...this.stateListeners]) cb(state);
  }

  /**
   * A bot on turn plays after a pause; nothing when it is a person's turn. The bot is asked at once
   * and thinks during the pause: its move lands when the pause is over and the answer is there,
   * whichever comes later.
   */
  private scheduleBot(): void {
    this.clearBotTimer();
    const { game } = this;
    if (this.gone || game.position.ended) return;
    const current = game.seats.find((s) => s.seat === game.position.turn);
    // The bot plays its own seats, and the player's while it is handed over.
    if (!current || !(current.bot || this.saved.autoplay)) return;
    const actor = current.bot ? `bot:${current.seat}` : BOT_FOR_ME;
    const generation = this.generation;
    const { seat } = current;
    const { position, seed } = game;
    const speed = this.saved.speed ?? 1;
    let answer: { move: Placement | undefined } | undefined;
    let paused = false;
    const play = () => {
      if (!answer || !paused || generation !== this.generation || this.gone) return;
      this.playBot(position, seed, seat, actor, answer.move);
    };
    this.botTimer = this.deps.setTimeout(() => {
      this.botTimer = undefined;
      paused = true;
      play();
    }, BOT_DELAY_MS / speed);
    void this.deps
      .askBot({ position, colour: seat, budget: botBudget(speed), seed: botSeed(seed, position.moveNumber, seat) })
      .catch(() => undefined)
      .then((move) => {
        answer = { move };
        play();
      });
  }

  /** A bot's move, the same path as the player's; the simple bot moves when it has none or a refused one. */
  private playBot(position: Position, seed: number, seat: number, actor: string, move: Placement | undefined): void {
    const result = move ? this.handle("place", move, actor) : undefined;
    if (result?.ok) return;
    // The bot found nothing or a refused move (it should not): the simple bot moves instead.
    log.error("client.error", { kind: "bot.fallback", cmd: "place", code: result?.code ?? "NO_MOVE" });
    const fallback = simpleBotMove(position, seat, botRng(seed, position, seat));
    if (fallback) this.handle("place", fallback, actor);
  }

  private clearBotTimer(): void {
    if (this.botTimer !== undefined) this.deps.clearTimeout(this.botTimer);
    this.botTimer = undefined;
    this.generation++;
  }

  private logFinished(): void {
    log.info("client.local.finished", { room: this.roomId, winners: this.game.winners.join(","), moves: this.game.position.moveNumber });
  }
}
