// @vitest-environment jsdom
import { cellAt, chooseBotCell, DAILY_TARGETS, PLACEMENTS_PER_SEAT, type BotStrategy } from "@palikka/rules";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dailyRecordOf, loadDailyRecord, todayString } from "./dailyRecord.ts";
import { isDailyRoomId, loadLocalGame } from "./localGameStore.ts";
import { BOT_DELAY_MS, LocalRoom } from "./localRoom.ts";
import { loadResume, saveResume } from "./resumeRecord.ts";
import { createConnector } from "./useGameSession.ts";
import { toGameView } from "./viewModel.ts";

const DATE = "2026-09-27";
const quiet = { setTimeout: () => 0, clearTimeout: () => {} };

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

/** A new game with bot timers switched off (Maija, the host, has the first turn). */
function quietGame(bots = 1, strategy: BotStrategy = chooseBotCell) {
  return LocalRoom.create("Maija", bots, { seed: () => 7, strategy, ...quiet });
}

/** A game with real (fake-timer) bot pauses. */
function timedGame(bots = 1) {
  return LocalRoom.create("Maija", bots, { seed: () => 7, strategy: chooseBotCell });
}

const viewOf = (room: LocalRoom) => toGameView(room.state, room.roomId, room.sessionId)!;
/** Maija claims the first empty cell. */
const placeFree = (room: LocalRoom) => room.request("place", cellAt(room.game.board.indexOf(0)));

describe("bots › Quick game against bots (on the device)", () => {
  it("One against three: Maija and the forest animals, Maija on turn with no clock", () => {
    const view = viewOf(quietGame(3));
    expect(view.seats.map((s) => [s.seat, s.name, s.isBot])).toEqual([
      [1, "Maija", false],
      [2, "Kettu", true],
      [3, "Ilves", true],
      [4, "Pöllö", true],
    ]);
    expect(view).toMatchObject({ phase: "playing", isMyTurn: true, turnSeat: 1, turnDeadline: 0, canKick: false });
  });

  it("commands answer like the server and every step is saved", async () => {
    const room = quietGame();
    expect(await room.request("place", { row: 0, col: 0 })).toEqual({ ok: true });
    expect(await room.request("place", { row: 0, col: 1 })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(await room.request("kick", { seat: 2 })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(loadLocalGame(room.roomId)?.game.board[0]).toBe(1);
  });

  it("bots play after the server's pause, and the game plays to its end", async () => {
    vi.useFakeTimers();
    const room = timedGame(2);
    await placeFree(room);
    expect(room.game.turnSeat).toBe(2);
    vi.advanceTimersByTime(BOT_DELAY_MS - 1);
    expect(room.game.turnSeat).toBe(2);
    vi.advanceTimersByTime(1);
    expect(room.game.turnSeat).toBe(3);
    while (room.game.step !== "finished") {
      if (room.game.turnSeat === 1) await placeFree(room);
      else vi.advanceTimersByTime(BOT_DELAY_MS);
    }
    expect(room.game.seats.every((s) => s.placed === PLACEMENTS_PER_SEAT)).toBe(true);
    expect(viewOf(room).winnerSeat).toBeGreaterThan(0);
  });

  it("a rejected bot choice falls back to the first empty cell", async () => {
    vi.useFakeTimers();
    const room = LocalRoom.create("Maija", 1, { seed: () => 7, strategy: () => ({ row: 0, col: 0 }) });
    await room.request("place", { row: 0, col: 0 });
    vi.advanceTimersByTime(BOT_DELAY_MS);
    expect(room.game.board[1]).toBe(2);
  });

  it("a restored game continues where it was", async () => {
    const room = quietGame();
    await room.request("place", { row: 3, col: 3 });
    room.removeAllListeners();
    const restored = LocalRoom.restore(room.roomId, quiet)!;
    expect(restored.game.turnSeat).toBe(2);
    expect(viewOf(restored).seats[0]!.score).toBe(1);
  });

  it("Leaving a quick bot game: the game is gone", async () => {
    const room = quietGame();
    await room.leave();
    expect(loadLocalGame(room.roomId)).toBeUndefined();
  });

  it("Quick bot game again: a finished game's rematch is a new saved game with the same bots", async () => {
    vi.useFakeTimers();
    const room = timedGame(2);
    expect(await room.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    // The bot plays every seat to the end.
    await room.request("setAutoplay", { on: true });
    vi.advanceTimersByTime(3 * PLACEMENTS_PER_SEAT * BOT_DELAY_MS);
    expect(room.game.step).toBe("finished");
    expect(await room.request("rematch", {})).toEqual({ ok: true });
    const next = LocalRoom.restore(room.state.rematchRoomId!, quiet)!;
    expect(next.game.seats.map((s) => s.name)).toEqual(["Maija", "Kettu", "Ilves"]);
    expect(next.game.step).toBe("play");
  });
});

describe("autoplay › Autoplay in games on the device", () => {
  it("the bot plays Maija's turns until she takes back; her own command is refused meanwhile", async () => {
    vi.useFakeTimers();
    const room = timedGame();
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    expect(viewOf(room)).toMatchObject({ myAutoplay: true, isMyTurn: false, turnAutoplay: true });
    expect(await placeFree(room)).toEqual({ ok: false, code: "AUTOPLAYING" });
    vi.advanceTimersByTime(BOT_DELAY_MS);
    expect(room.game.turnSeat).toBe(2);
    vi.advanceTimersByTime(2 * BOT_DELAY_MS);
    expect(room.game.turn).toBeGreaterThanOrEqual(3);

    expect(await room.request("setAutoplay", { on: false })).toEqual({ ok: true });
    while (room.game.turnSeat !== 1) vi.advanceTimersByTime(BOT_DELAY_MS);
    const { turn } = room.game;
    vi.advanceTimersByTime(10 * BOT_DELAY_MS);
    expect(room.game).toMatchObject({ turn, turnSeat: 1 });
  });

  it("Daily puzzle: no autoplay", async () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(viewOf(room).canAutoplay).toBe(false);
  });
});

describe("spectators › Watching a game of bots (on the device)", () => {
  it("Watch three bots: the viewer is a spectator; they play to the end by themselves", () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(3, 1, { seed: () => 7 });
    const view = viewOf(room);
    expect(view).toMatchObject({ spectating: true, botOnly: true });
    expect(view.seats.map((s) => s.name)).toEqual(["Kettu", "Ilves", "Pöllö"]);
    vi.advanceTimersByTime(3 * PLACEMENTS_PER_SEAT * BOT_DELAY_MS);
    expect(room.game.step).toBe("finished");
  });

  it("Faster bots: 4× shrinks the pause; the spectator cannot play", async () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(2, 1, { seed: () => 7 });
    expect(await room.request("setSpeed", { speed: 4 })).toEqual({ ok: true });
    expect(viewOf(room).botSpeed).toBe(4);
    // The pause already running keeps its length; the next ones are a quarter.
    vi.advanceTimersByTime(BOT_DELAY_MS);
    const { turn } = room.game;
    vi.advanceTimersByTime(BOT_DELAY_MS / 4);
    expect(room.game.turn).toBe(turn + 1);
    expect(await placeFree(room)).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("never saved: the quick game slot is left alone", async () => {
    const game = quietGame();
    LocalRoom.createWatch(2, 1, quiet);
    expect(loadLocalGame(game.roomId)).toBeDefined();
  });
});

describe("daily-puzzle › The puzzle on the device", () => {
  const solve = async (room: LocalRoom, misses = 0) => {
    const targets = room.game.targets!;
    const miss = room.game.board.findIndex((_, i) => !targets.includes(i));
    for (let i = 0; i < misses; i++) await room.request("place", cellAt(miss + i));
    for (const t of targets) await room.request("place", cellAt(t));
  };

  it("a new attempt is the date's puzzle in its own slot, with its par recorded", () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    expect(isDailyRoomId(room.roomId)).toBe(true);
    expect(dailyRecordOf(room.roomId)).toMatchObject({ date: DATE, par: DAILY_TARGETS });
    expect(viewOf(room)).toMatchObject({ daily: true, par: DAILY_TARGETS, targets: room.game.targets });
    expect(todayString(new Date(2026, 8, 7))).toBe("2026-09-07");
  });

  it("Undo a move: back before the last placement; nothing left to undo at the start", async () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    await room.request("place", { row: 0, col: 0 });
    expect(viewOf(room).undoable).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: true });
    expect(room.game).toMatchObject({ turn: 1 });
    expect(room.game.board[0]).toBe(0);
  });

  it("Solved: the best of several attempts is kept", async () => {
    const first = LocalRoom.createDaily("Maija", DATE, quiet);
    await solve(first, 2);
    expect(first.game.step).toBe("finished");
    expect(loadDailyRecord(DATE)?.best?.turns).toBe(DAILY_TARGETS + 2);
    const second = LocalRoom.createDaily("Maija", DATE, quiet);
    await solve(second);
    expect(loadDailyRecord(DATE)?.best?.turns).toBe(DAILY_TARGETS);
    const third = LocalRoom.createDaily("Maija", DATE, quiet);
    await solve(third, 1);
    expect(loadDailyRecord(DATE)?.best?.turns).toBe(DAILY_TARGETS);
    expect(await third.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("Leaving midway: the attempt stays saved and the connector continues it", async () => {
    const room = LocalRoom.createDaily("Maija", todayString(), quiet);
    await room.request("place", { row: 0, col: 0 });
    await room.leave();
    const again = await createConnector().playDaily({ nickname: "Maija", date: todayString() });
    expect(again.roomId).toBe(room.roomId);
    await again.leave();
  });
});

describe("game-session › Resume after closing the app (on the device)", () => {
  it("Bot game on the device the next day: offered without the time limit", () => {
    saveResume("local:local-abc", "local-abc", 0);
    expect(loadResume(24 * 3600_000)).toMatchObject({ roomId: "local-abc" });
  });

  it("the connector restores a saved game by token and by id, and refuses a gone one like a gone room", async () => {
    const room = quietGame();
    const connector = createConnector();
    const byToken = await connector.reconnect(room.reconnectionToken);
    expect(byToken.roomId).toBe(room.roomId);
    expect((await connector.joinById(room.roomId, { nickname: "Maija" })).roomId).toBe(room.roomId);
    await room.leave();
    await expect(connector.reconnect(room.reconnectionToken)).rejects.toMatchObject({ code: 524 });
  });

  it("Offline: a bot game starts through the connector without any network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const room = await createConnector().createBotGame({ nickname: "Maija", bots: 1 });
    expect(room.roomId).toMatch(/^local-/);
    expect(fetchSpy).not.toHaveBeenCalled();
    await room.leave();
  });
});
