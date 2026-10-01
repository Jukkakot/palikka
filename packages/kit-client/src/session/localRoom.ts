import { BOT_SPEEDS, MAX_GAME_SEED, type BotSpeed, type CommandResult, type PlayResult } from "@game-kit/protocol";
import type { GameClientDefinition } from "../definition.ts";
import { log } from "../logging/logger.ts";
import {
  clearLocalGame,
  isWatchRoomId,
  LOCAL_SAVE_VERSION,
  loadLocalGame,
  localToken,
  newLocalRoomId,
  saveLocalGame,
  WATCH_ROOM_PREFIX,
  type HistoryEntry,
  type SavedLocalGame,
} from "./localGameStore.ts";
import type { LobbyView, SyncedLobbyState, SyncedPlayer } from "./lobbyView.ts";
import type { GameRoomLike } from "./roomLike.ts";

/** The pause before a bot's move, so people can follow it (the server uses the same). */
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
}

const defaultDeps = (): LocalRoomDeps => ({
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  seed: () => {
    const [value] = globalThis.crypto.getRandomValues(new Uint32Array(1));
    return value! % (MAX_GAME_SEED + 1);
  },
});

/**
 * A game against bots that runs on this device, behind the same interface as a game room on the
 * server: the session, view model and screens cannot tell the difference. Commands answer like the
 * server; bots play through the same path after the server's pause, their moves computed off the UI
 * thread; every step is saved. "Peru" takes back the player's last move and the bots' after it.
 */
export class LocalRoom<G, M, O, V extends LobbyView = LobbyView> implements GameRoomLike {
  readonly roomId: string;
  readonly sessionId = ME;
  readonly reconnectionToken: string;
  private saved: SavedLocalGame<G, O>;
  private readonly definition: GameClientDefinition<G, M, O, V>;
  private readonly deps: LocalRoomDeps;
  private stateListeners: ((state: SyncedLobbyState) => void)[] = [];
  private leaveListeners: ((code: number) => void)[] = [];
  private botTimer: unknown;
  /** Bumped whenever a pending bot move becomes stale (a new state, an undo, a leave). */
  private generation = 0;
  private gone = false;

  private constructor(saved: SavedLocalGame<G, O>, definition: GameClientDefinition<G, M, O, V>, deps: LocalRoomDeps) {
    this.saved = saved;
    this.definition = definition;
    this.deps = deps;
    this.roomId = saved.roomId;
    this.reconnectionToken = localToken(saved.roomId);
    if (!this.watching) saveLocalGame(saved, definition.local.save);
    this.scheduleBot();
  }

  /** Starts a new game with `options` against `bots` bots and saves it, replacing any saved one. */
  static create<G, M, O, V extends LobbyView>(
    definition: GameClientDefinition<G, M, O, V>,
    nickname: string,
    bots: number,
    options: O = definition.defaultOptions,
    deps: Partial<LocalRoomDeps> = {},
  ): LocalRoom<G, M, O, V> {
    const all = { ...defaultDeps(), ...deps };
    return new LocalRoom(newGame(definition, nickname, bots, options, all), definition, all);
  }

  /** Starts a game with `options` and `bots` bots only, to watch at `speed`; it is never saved. */
  static createWatch<G, M, O, V extends LobbyView>(
    definition: GameClientDefinition<G, M, O, V>,
    bots: number,
    speed: BotSpeed = 1,
    options: O = definition.defaultOptions,
    deps: Partial<LocalRoomDeps> = {},
  ): LocalRoom<G, M, O, V> {
    const all = { ...defaultDeps(), ...deps };
    return new LocalRoom(newWatchGame(definition, bots, speed, options, all), definition, all);
  }

  /** The saved game `roomId`, continued where it was; undefined when it is gone. */
  static restore<G, M, O, V extends LobbyView>(
    definition: GameClientDefinition<G, M, O, V>,
    roomId: string,
    deps: Partial<LocalRoomDeps> = {},
  ): LocalRoom<G, M, O, V> | undefined {
    const saved = loadLocalGame<G, O>(roomId, definition.local.save);
    return saved && new LocalRoom(saved, definition, { ...defaultDeps(), ...deps });
  }

  get game(): G {
    return this.saved.game;
  }

  private get rules() {
    return this.definition.rules;
  }

  /** The seated person (seat 1 unless only bots play). */
  private get mySeat(): number | undefined {
    return this.saved.seats.find((s) => !s.bot)?.seat;
  }

  /** The game in the shape the server syncs, as seen by the player. */
  get state(): SyncedLobbyState {
    const { game, rematchRoomId, seats } = this.saved;
    const over = this.rules.isOver(game);
    const players = new Map<string, SyncedPlayer>(
      seats.map((s) => [
        s.bot ? `bot:${s.seat}` : ME,
        { seat: s.seat, name: s.name, bot: s.bot, ...(!s.bot && { autoplay: this.saved.autoplay ?? false }), connected: true },
      ]),
    );
    return {
      game: this.definition.local.child(game),
      players,
      turnSeat: this.rules.seatOnTurn(game),
      phase: over ? "finished" : "play",
      hostSeat: 1,
      winners: this.rules.winners(game),
      turn: this.definition.local.turn(game),
      turnDeadline: 0,
      turnExpired: false,
      botRunnerSeat: 0,
      spectators: 0,
      botSpeed: this.saved.speed ?? 1,
      rematchRoomId: rematchRoomId ?? "",
      undo: !this.watching,
      undoable: !over && (this.saved.history?.length ?? 0) > 0,
    };
  }

  onStateChange(cb: (state: SyncedLobbyState) => void): void {
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
      if (!this.rules.isOver(this.game)) this.logFinished();
      if (!this.watching) clearLocalGame(this.roomId, this.definition.local.save);
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
    const seat = actor === ME || actor === BOT_FOR_ME ? this.mySeat! : Number(actor.slice("bot:".length));
    switch (type) {
      case "move": {
        if (actor === ME && this.saved.autoplay) return { ok: false, code: "AUTOPLAYING" };
        const { move: raw } = (payload ?? {}) as { move?: unknown };
        const move = this.definition.local.parseMove(raw);
        if (move === undefined) return { ok: false, code: "INVALID_COMMAND" };
        const before = this.game;
        const result = this.rules.play(before, seat, move);
        // The game before each of the player's own moves, with its seat, for "Peru".
        const history = result.ok && actor === ME ? [...(this.saved.history ?? []), { seat, game: before }] : this.saved.history;
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

  private apply(result: PlayResult<G>, history: HistoryEntry<G>[] | undefined): CommandResult {
    if (!result.ok) return { ok: false, code: result.code };
    const finishing = this.rules.isOver(result.game) && !this.rules.isOver(this.game);
    this.update({ ...this.saved, game: result.game, ...(history && { history }) });
    if (finishing) this.logFinished();
    return { ok: true };
  }

  /** The bot takes over the player's seat or gives it back; on the player's turn it plays it. */
  private setAutoplay(payload: unknown): CommandResult {
    const { on } = (payload ?? {}) as { on?: unknown };
    if (typeof on !== "boolean") return { ok: false, code: "INVALID_COMMAND" };
    if (this.rules.isOver(this.game)) return { ok: false, code: "WRONG_PHASE" };
    if ((this.saved.autoplay ?? false) === on) return { ok: true };
    this.update({ ...this.saved, autoplay: on });
    return { ok: true };
  }

  /** A game of bots to watch: every pause of a bot's turn is divided by the speed. */
  private setSpeed(payload: unknown): CommandResult {
    const { speed } = (payload ?? {}) as { speed?: unknown };
    if (!BOT_SPEEDS.includes(speed as BotSpeed)) return { ok: false, code: "INVALID_COMMAND" };
    if (this.rules.isOver(this.game)) return { ok: false, code: "WRONG_PHASE" };
    this.saved = { ...this.saved, speed: speed as BotSpeed };
    this.emit();
    return { ok: true };
  }

  /** "Peru": back to the game before the player's last move (the bots' moves after it go too). */
  private undo(): CommandResult {
    const history = this.saved.history ?? [];
    const at = history.findLastIndex((entry) => entry.seat === this.mySeat);
    if (this.watching || at < 0 || this.rules.isOver(this.game)) return { ok: false, code: "WRONG_PHASE" };
    this.update({ ...this.saved, game: history[at]!.game, history: history.slice(0, at) });
    return { ok: true };
  }

  /** Creates the next game with the same seats and options and syncs its id; the session then moves there. */
  private rematch(): CommandResult {
    if (!this.rules.isOver(this.game)) return { ok: false, code: "WRONG_PHASE" };
    if (this.saved.rematchRoomId) return { ok: true };
    const { seats, options } = this.saved;
    const next = newGame(this.definition, seats.find((s) => !s.bot)!.name, seats.filter((s) => s.bot).length, options, this.deps);
    // The new game is the saved one now (the session opens it by its id); this one only remembers where it went.
    this.saved = { ...this.saved, rematchRoomId: next.roomId };
    this.emit();
    return { ok: true };
  }

  /** Saves and publishes a new state, then lets a bot on turn play. */
  private update(saved: SavedLocalGame<G, O>): void {
    this.saved = saved;
    if (!this.watching) saveLocalGame(saved, this.definition.local.save);
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
    if (this.gone || this.rules.isOver(game)) return;
    const current = this.saved.seats.find((s) => s.seat === this.rules.seatOnTurn(game));
    // The bot plays its own seats, and the player's while it is handed over.
    if (!current || !(current.bot || this.saved.autoplay)) return;
    const actor = current.bot ? `bot:${current.seat}` : BOT_FOR_ME;
    const generation = this.generation;
    const speed = this.saved.speed ?? 1;
    let answer: { move: M | undefined } | undefined;
    let paused = false;
    const play = () => {
      if (!answer || !paused || generation !== this.generation || this.gone) return;
      this.playBot(game, actor, answer.move);
    };
    this.botTimer = this.deps.setTimeout(() => {
      this.botTimer = undefined;
      paused = true;
      play();
    }, BOT_DELAY_MS / speed);
    void this.definition.local
      .askBot(game, speed)
      .catch(() => undefined)
      .then((move) => {
        answer = { move };
        play();
      });
  }

  /** A bot's move, the same path as the player's; the rules' simple bot moves when it has none or a refused one. */
  private playBot(game: G, actor: string, move: M | undefined): void {
    const result = move !== undefined ? this.handle("move", { move }, actor) : undefined;
    if (result?.ok) return;
    // The bot found nothing or a refused move (it should not): the simple bot moves instead.
    log.error("client.error", { kind: "bot.fallback", cmd: "move", code: result?.code ?? "NO_MOVE" });
    const fallback = this.rules.fallbackMove(game);
    if (fallback !== undefined) this.handle("move", { move: fallback }, actor);
  }

  private clearBotTimer(): void {
    if (this.botTimer !== undefined) this.deps.clearTimeout(this.botTimer);
    this.botTimer = undefined;
    this.generation++;
  }

  private logFinished(): void {
    log.info("client.local.finished", {
      room: this.roomId,
      winners: this.rules.winners(this.game).join(","),
      ...this.definition.local.logFacts?.(this.game),
    });
  }
}

function logStarted<G, M, O, V extends LobbyView>(definition: GameClientDefinition<G, M, O, V>, saved: SavedLocalGame<G, O>, watch = false): void {
  log.info("client.local.started", {
    room: saved.roomId,
    ...(saved.options as object),
    seats: saved.seats.map((s) => s.seat).join(","),
    startSeat: definition.rules.seatOnTurn(saved.game),
    ...definition.local.logFacts?.(saved.game),
    ...(watch && { watch: true }),
  });
}

/** A new saved game against `bots` bots with `options`, replacing any saved one; logs its start. */
function newGame<G, M, O, V extends LobbyView>(
  definition: GameClientDefinition<G, M, O, V>,
  nickname: string,
  bots: number,
  options: O,
  deps: LocalRoomDeps,
): SavedLocalGame<G, O> {
  const roomId = newLocalRoomId();
  const seats = definition.local.seats({ nickname, bots, options });
  const game = definition.rules.start(deps.seed(), seats, options);
  const saved: SavedLocalGame<G, O> = { version: LOCAL_SAVE_VERSION, roomId, game, options, seats: [...seats] };
  saveLocalGame(saved, definition.local.save);
  logStarted(definition, saved);
  return saved;
}

/** A game of bots only to watch, in seats 1 upwards. Never saved. */
function newWatchGame<G, M, O, V extends LobbyView>(
  definition: GameClientDefinition<G, M, O, V>,
  bots: number,
  speed: BotSpeed,
  options: O,
  deps: LocalRoomDeps,
): SavedLocalGame<G, O> {
  const roomId = newLocalRoomId(Math.random, WATCH_ROOM_PREFIX);
  const seats = definition.local.seats({ bots, options });
  const game = definition.rules.start(deps.seed(), seats, options);
  const saved: SavedLocalGame<G, O> = { version: LOCAL_SAVE_VERSION, roomId, game, options, speed, seats: [...seats] };
  logStarted(definition, saved, true);
  return saved;
}
