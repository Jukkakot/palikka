import { BOT_NAMES, BOT_SPEEDS, type BotSpeed, type CommandResult } from "@palikka/protocol";
import {
  applyPlace,
  botRngFor,
  botViewOf,
  cellAt,
  chooseBotCell,
  MAX_SEED,
  startDailyPuzzle,
  startGame,
  type BotStrategy,
  type GameCommandResult,
  type GameState,
  type NewSeat,
} from "@palikka/rules";
import { log } from "../logging/logger.ts";
import { loadDailyRecord, saveDailyRecord, saveDailyResult } from "./dailyRecord.ts";
import {
  clearLocalGame,
  DAILY_ROOM_PREFIX,
  isDailyRoomId,
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

/** The server's bot pause: a bot's turn this long after it starts. */
export const BOT_DELAY_MS = 1_000;

/** The player's key in the synced players (their session id). */
const ME = "me";
/** The bot acting for the player while their seat is handed over. */
const BOT_FOR_ME = "bot:me";

export interface LocalRoomDeps {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  /** A fresh game seed. */
  seed(): number;
  strategy: BotStrategy;
}

const defaultDeps = (): LocalRoomDeps => ({
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  seed: () => {
    const [value] = globalThis.crypto.getRandomValues(new Uint32Array(1));
    return value! % (MAX_SEED + 1);
  },
  strategy: chooseBotCell,
});

/** The seats of a quick game: the player in seat 1, `bots` bots in the next seats. */
function quickSeats(nickname: string, bots: number): NewSeat[] {
  return [{ seat: 1, name: nickname, bot: false }, ...BOT_NAMES.slice(0, bots).map((name, i) => ({ seat: i + 2, name, bot: true }))];
}

/** A new saved game against `bots` bots, replacing any saved one; logs its start. */
function newGame(nickname: string, bots: number, deps: LocalRoomDeps): SavedLocalGame {
  const roomId = newLocalRoomId();
  // The player hosts, so they play first.
  const game = startGame(deps.seed(), quickSeats(nickname, bots), 1);
  const saved = { roomId, game };
  saveLocalGame(saved);
  log.info("client.local.started", { room: roomId, dealSeed: game.seed, seats: game.seats.map((s) => s.seat).join(","), startSeat: game.turnSeat });
  return saved;
}

/** A game of `bots` bots only to watch, in seats 1 upwards; a seat drawn from the seed starts. Never saved. */
function newWatchGame(bots: number, speed: BotSpeed, deps: LocalRoomDeps): SavedLocalGame {
  const roomId = newLocalRoomId(Math.random, WATCH_ROOM_PREFIX);
  const seats = BOT_NAMES.slice(0, bots).map((name, i) => ({ seat: i + 1, name, bot: true }));
  // No host seated: the rules draw the first seat.
  const game = startGame(deps.seed(), seats);
  log.info("client.local.started", { room: roomId, dealSeed: game.seed, seats: game.seats.map((s) => s.seat).join(","), startSeat: game.turnSeat, watch: true });
  return { roomId, game, speed };
}

/**
 * A game against bots that runs on this device, behind the same interface as a game room on the
 * server: the session, view model and screens cannot tell the difference. Commands answer like the
 * server; bots play through the same path with the server's pause; every step is saved.
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

  /** Starts an attempt at the daily puzzle of `date` (a solo game in its own save slot); the day's best stays. */
  static createDaily(name: string, date: string, deps: Partial<LocalRoomDeps> = {}): LocalRoom {
    const roomId = newLocalRoomId(Math.random, DAILY_ROOM_PREFIX);
    const { game, par } = startDailyPuzzle(date, name);
    saveDailyRecord({ date, roomId, par, best: loadDailyRecord(date)?.best });
    log.info("client.daily.started", { room: roomId, date, dealSeed: game.seed, par });
    return new LocalRoom({ roomId, game, par, history: [] }, { ...defaultDeps(), ...deps });
  }

  /** The saved game `roomId`, continued where it was; undefined when it is gone. */
  static restore(roomId: string, deps: Partial<LocalRoomDeps> = {}): LocalRoom | undefined {
    const saved = loadLocalGame(roomId);
    return saved && new LocalRoom(saved, { ...defaultDeps(), ...deps });
  }

  get game(): GameState {
    return this.saved.game;
  }

  /** The game in the shape the server syncs, as seen by the player. */
  get state(): SyncedState {
    const { game, rematchRoomId } = this.saved;
    const players = new Map<string, SyncedPlayer>(
      game.seats.map((s) => [
        s.bot ? `bot:${s.seat}` : ME,
        {
          seat: s.seat,
          name: s.name,
          bot: s.bot,
          ...(!s.bot && { autoplay: this.saved.autoplay ?? false }),
          connected: true,
          placed: s.placed,
        },
      ]),
    );
    return {
      cells: game.board,
      players,
      turnSeat: game.turnSeat,
      phase: game.step,
      hostSeat: 1,
      winnerSeat: game.winnerSeat,
      turn: game.turn,
      turnDeadline: 0,
      turnExpired: false,
      spectators: 0,
      botSpeed: this.saved.speed ?? 1,
      rematchRoomId: rematchRoomId ?? "",
      ...(this.daily && { targets: game.targets ?? [], par: this.saved.par ?? 0, undoable: (this.saved.history?.length ?? 0) > 0 }),
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

  /** Leaving on purpose: the game is over and forgotten; an unfinished daily puzzle stays saved to continue. */
  leave(): Promise<void> {
    if (!this.gone) {
      this.gone = true;
      this.clearBotTimer();
      const unfinished = this.game.step !== "finished";
      if (this.watching) {
        if (unfinished) this.logFinished(0);
      } else if (!(unfinished && this.daily)) {
        if (unfinished) this.logFinished(0);
        clearLocalGame(this.roomId);
      }
    }
    return Promise.resolve();
  }

  private get daily(): boolean {
    return isDailyRoomId(this.roomId);
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
        const { row, col } = (payload ?? {}) as { row?: unknown; col?: unknown };
        if (!Number.isInteger(row) || !Number.isInteger(col)) return { ok: false, code: "INVALID_COMMAND" };
        const before = this.game;
        const result = applyPlace(before, seat, { row: row as number, col: col as number });
        // The puzzle remembers the state before each placement, to undo it.
        if (result.ok && this.daily) this.saved = { ...this.saved, history: [...(this.saved.history ?? []), { game: before }] };
        return this.apply(result);
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

  private apply(result: GameCommandResult): CommandResult {
    if (!result.ok) return result;
    const finishing = result.state.step === "finished" && this.game.step !== "finished";
    // The result is stored before the finished state is published, so the end screen can show it.
    if (finishing && this.daily) {
      saveDailyResult(this.roomId, { turns: result.state.turn });
      log.info("client.daily.finished", { room: this.roomId, turns: result.state.turn, par: this.saved.par });
    }
    this.update({ ...this.saved, game: result.state });
    if (finishing && !this.daily) this.logFinished(result.state.winnerSeat);
    return { ok: true };
  }

  /** The bot takes over the player's seat or gives it back; on the player's turn it plays it. */
  private setAutoplay(payload: unknown): CommandResult {
    const { on } = (payload ?? {}) as { on?: unknown };
    if (typeof on !== "boolean") return { ok: false, code: "INVALID_COMMAND" };
    // The puzzle is the player's own to solve.
    if (this.daily || this.game.step === "finished") return { ok: false, code: "WRONG_PHASE" };
    if ((this.saved.autoplay ?? false) === on) return { ok: true };
    this.update({ ...this.saved, autoplay: on });
    return { ok: true };
  }

  /** A game of bots to watch: every pause of a bot's turn is divided by the speed. */
  private setSpeed(payload: unknown): CommandResult {
    const { speed } = (payload ?? {}) as { speed?: unknown };
    if (!BOT_SPEEDS.includes(speed as BotSpeed)) return { ok: false, code: "INVALID_COMMAND" };
    if (this.game.step === "finished") return { ok: false, code: "WRONG_PHASE" };
    this.saved = { ...this.saved, speed: speed as BotSpeed };
    this.emit();
    return { ok: true };
  }

  /** Daily puzzle: back to the state before the last placement. */
  private undo(): CommandResult {
    const history = this.saved.history ?? [];
    const last = history.at(-1);
    if (!this.daily || !last || this.game.step === "finished") return { ok: false, code: "WRONG_PHASE" };
    this.update({ ...this.saved, game: last.game, history: history.slice(0, -1) });
    return { ok: true };
  }

  /** Creates the next game with the same seats and syncs its id; the session then moves there. */
  private rematch(): CommandResult {
    // A daily puzzle has its own "Uudelleen".
    if (this.game.step !== "finished" || this.daily) return { ok: false, code: "WRONG_PHASE" };
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

  /** A bot on turn plays after a pause; nothing when it is a person's turn. */
  private scheduleBot(): void {
    this.clearBotTimer();
    const { game } = this;
    if (this.gone || game.step === "finished") return;
    const current = game.seats.find((s) => s.seat === game.turnSeat);
    // The bot plays its own seats, and the player's while it is handed over.
    if (!current || !(current.bot || this.saved.autoplay)) return;
    const actor = current.bot ? `bot:${current.seat}` : BOT_FOR_ME;
    this.botTimer = this.deps.setTimeout(() => this.playBot(current.seat, actor), this.botDelay(BOT_DELAY_MS));
  }

  /** A bot's turn, as on the server; a rejected choice falls back to the first empty cell. */
  private playBot(seat: number, actor: string): void {
    this.botTimer = undefined;
    const cell = this.deps.strategy(botViewOf(this.game, seat), botRngFor(this.game, seat));
    const result = this.handle("place", cell, actor);
    if (result.ok) return;
    log.error("client.error", { kind: "bot.fallback", cmd: "place", code: result.code });
    this.handle("place", cellAt(this.game.board.indexOf(0)), actor);
  }

  /** A bot pause at the chosen speed (1× unless a watched game was sped up). */
  private botDelay(ms: number): number {
    return ms / (this.saved.speed ?? 1);
  }

  private clearBotTimer(): void {
    if (this.botTimer !== undefined) this.deps.clearTimeout(this.botTimer);
    this.botTimer = undefined;
  }

  private logFinished(winner: number): void {
    log.info("client.local.finished", { room: this.roomId, winner, turns: this.game.turn });
  }
}
