// @vitest-environment jsdom
import { greedyBotTurn, homeSquare, reverseOf, type BotStrategy } from "@labyrinth/rules";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConnector } from "./useGameSession.ts";
import { loadLocalGame } from "./localGameStore.ts";
import { BOT_MOVE_DELAY_MS, BOT_SHIFT_DELAY_MS, LocalRoom } from "./localRoom.ts";
import { loadResume, saveResume } from "./resumeRecord.ts";
import { toGameView } from "./viewModel.ts";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

/** A new game with bot timers switched off (Maija, the host, has the first turn). */
function quietGame(bots = 1, strategy: BotStrategy = greedyBotTurn) {
  return LocalRoom.create("Maija", bots, { seed: () => 7, strategy, setTimeout: () => 0, clearTimeout: () => {} });
}

/** A game with real (fake-timer) bot pauses where Maija has shifted N1 and stayed: Robo is on turn. */
async function robosTurn() {
  const room = LocalRoom.create("Maija", 1, { seed: () => 7, strategy: greedyBotTurn });
  await room.request("shift", { insertion: "N1", rotation: 0 });
  await room.request("move", room.game.seats[0]!.pawn);
  return room;
}

describe("bots › Quick game against bots (on the device)", () => {
  it("One against three: Maija, Robo, Pixel and Byte with 6 cards each; only her own target is visible", () => {
    const room = LocalRoom.create("Maija", 3, { setTimeout: () => 0, clearTimeout: () => {} });
    const view = toGameView(room.state, room.roomId, room.sessionId)!;
    expect(view.seats.map((s) => [s.name, s.cards, s.isBot])).toEqual([
      ["Maija", 6, false],
      ["Robo", 6, true],
      ["Pixel", 6, true],
      ["Byte", 6, true],
    ]);
    expect(view.myTarget).toBeDefined();
    expect(view.seats.filter((s) => s.isBot).every((s) => s.target === undefined)).toBe(true);
  });

  it("No turn clock: the view has no deadline and nothing to kick", () => {
    const room = quietGame();
    const view = toGameView(room.state, room.roomId, room.sessionId)!;
    expect(view).toMatchObject({ turnDeadline: 0, turnExpired: false, canKick: false, isMyTurn: true, step: "shift" });
  });

  it("commands answer like the server and every step is saved", async () => {
    const room = quietGame();
    const changes: unknown[] = [];
    room.onStateChange((s) => changes.push(s));
    expect(await room.request("move", homeSquare(1))).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(await room.request("shift", { insertion: "X9", rotation: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(await room.request("kick", { seat: 2 })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(await room.request("shift", { insertion: "N1", rotation: 0 })).toEqual({ ok: true });
    expect(changes).toHaveLength(1);
    expect(loadLocalGame(room.roomId)!.game.step).toBe("move");
    expect(await room.request("move", room.game.seats[0]!.pawn)).toEqual({ ok: true });
    expect(room.game.turnSeat).toBe(2);
    expect(await room.request("shift", { insertion: reverseOf("N1"), rotation: 0 })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("First player starts: Maija, the host, always has the first turn", () => {
    for (const seed of [1, 2, 3, 4]) expect(LocalRoom.create("Maija", 3, { seed: () => seed, setTimeout: () => 0 }).game.turnSeat).toBe(1);
  });

  it("bots play with the server's pauses", async () => {
    vi.useFakeTimers();
    const room = await robosTurn();
    vi.advanceTimersByTime(BOT_SHIFT_DELAY_MS - 1);
    expect(room.game.step).toBe("shift");
    vi.advanceTimersByTime(1);
    expect(room.game.step).toBe("move");
    vi.advanceTimersByTime(BOT_MOVE_DELAY_MS);
    expect(room.game).toMatchObject({ step: "shift", turnSeat: 1 });
  });

  it("a restored game continues where it was, a bot's pending move included", async () => {
    vi.useFakeTimers();
    const room = await robosTurn();
    vi.advanceTimersByTime(BOT_SHIFT_DELAY_MS);
    const before = room.game;
    room.removeAllListeners();
    // The page goes away mid-turn: its timers with it.
    vi.clearAllTimers();
    const restored = LocalRoom.restore(room.roomId, { strategy: greedyBotTurn })!;
    expect(restored.game).toEqual(before);
    vi.advanceTimersByTime(BOT_MOVE_DELAY_MS);
    expect(restored.game).toMatchObject({ turnSeat: 1, step: "shift" });
  });

  it("Leaving a quick bot game: the game is gone", async () => {
    const room = quietGame();
    await room.leave();
    expect(LocalRoom.restore(room.roomId)).toBeUndefined();
    expect(await room.request("shift", { insertion: "N1", rotation: 0 })).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("Quick bot game again: a finished game's rematch is a new saved game with the same bots", async () => {
    const room = quietGame(2);
    expect(await room.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    // Finish it by handing Maija every card and walking home.
    const internal = room as unknown as { saved: { game: typeof room.game } };
    const me = room.game.seats[0]!;
    internal.saved = { ...internal.saved, game: { ...room.game, seats: [{ ...me, found: me.stack }, ...room.game.seats.slice(1)] } };
    await room.request("shift", { insertion: "N3", rotation: 0 });
    await room.request("move", homeSquare(1));
    expect(room.game.winnerSeat).toBe(1);
    expect(await room.request("rematch", {})).toEqual({ ok: true });
    const next = room.state.rematchRoomId!;
    expect(next).not.toBe(room.roomId);
    await room.leave();
    const again = LocalRoom.restore(next)!;
    expect(again.game.seats.map((s) => s.name)).toEqual(["Maija", "Robo", "Pixel"]);
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
