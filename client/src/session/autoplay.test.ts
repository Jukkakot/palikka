// @vitest-environment jsdom
import { greedyBotTurn } from "@labyrinth/rules";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOT_MOVE_DELAY_MS, BOT_SHIFT_DELAY_MS, LocalRoom } from "./localRoom.ts";
import { toGameView } from "./viewModel.ts";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

/** Maija against Robo with real (fake-timer) bot pauses; Maija has the first turn. */
const newGame = () => LocalRoom.create("Maija", 1, { seed: () => 7, strategy: greedyBotTurn });
const viewOf = (room: LocalRoom) => toGameView(room.state, room.roomId, room.sessionId)!;
const TURN_MS = BOT_SHIFT_DELAY_MS + BOT_MOVE_DELAY_MS;

describe("autoplay › Autoplay in games on the device", () => {
  it("Quick game plays itself: the bot plays Maija's turns until she takes back", async () => {
    const room = newGame();
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    expect(viewOf(room)).toMatchObject({ myAutoplay: true, isMyTurn: false, turnAutoplay: true, canAutoplay: true });
    expect(viewOf(room).seats[0]!.autoplay).toBe(true);
    expect(await room.request("shift", { insertion: "N1", rotation: 0 })).toEqual({ ok: false, code: "AUTOPLAYING" });
    vi.advanceTimersByTime(TURN_MS);
    expect(room.game.turnSeat).toBe(2);
    // Robo's turn, then Maija's again, played by the bot.
    vi.advanceTimersByTime(2 * TURN_MS);
    expect(room.game.turn).toBeGreaterThanOrEqual(3);

    expect(await room.request("setAutoplay", { on: false })).toEqual({ ok: true });
    while (room.game.turnSeat !== 1) vi.advanceTimersByTime(BOT_MOVE_DELAY_MS);
    const { turn } = room.game;
    vi.advanceTimersByTime(10 * TURN_MS);
    expect(room.game).toMatchObject({ turn, turnSeat: 1, step: "shift" });
    expect(viewOf(room)).toMatchObject({ myAutoplay: false, isMyTurn: true });
  });

  it("Handed over after the own shift: the bot only walks", async () => {
    const room = newGame();
    await room.request("shift", { insertion: "N1", rotation: 0 });
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    vi.advanceTimersByTime(BOT_MOVE_DELAY_MS);
    expect(room.game).toMatchObject({ turnSeat: 2, step: "shift", lastInsertion: "N1" });
  });

  it("Taken back after the bot's shift: the pawn does not move by itself", async () => {
    const room = newGame();
    await room.request("setAutoplay", { on: true });
    vi.advanceTimersByTime(BOT_SHIFT_DELAY_MS);
    expect(room.game.step).toBe("move");
    await room.request("setAutoplay", { on: false });
    vi.advanceTimersByTime(10 * BOT_MOVE_DELAY_MS);
    expect(room.game).toMatchObject({ turnSeat: 1, step: "move" });
  });

  it("Continued later: a restored game still auto-plays Maija's seat", async () => {
    const room = newGame();
    await room.request("setAutoplay", { on: true });
    room.removeAllListeners();
    vi.clearAllTimers();
    const restored = LocalRoom.restore(room.roomId, { strategy: greedyBotTurn })!;
    expect(viewOf(restored).myAutoplay).toBe(true);
    vi.advanceTimersByTime(TURN_MS);
    expect(restored.game.turnSeat).toBe(2);
  });

  it("Daily puzzle: no autoplay", async () => {
    const room = LocalRoom.createDaily("Maija", "2026-09-27", { setTimeout: () => 0, clearTimeout: () => {} });
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(viewOf(room).canAutoplay).toBe(false);
  });
});
