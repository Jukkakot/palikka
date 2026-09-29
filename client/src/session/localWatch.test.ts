// @vitest-environment jsdom
import { greedyBotTurn } from "@labyrinth/rules";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConnector } from "./useGameSession.ts";
import { loadLocalGame } from "./localGameStore.ts";
import { BOT_MOVE_DELAY_MS, BOT_SHIFT_DELAY_MS, LocalRoom } from "./localRoom.ts";
import { toGameView } from "./viewModel.ts";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

const quiet = { setTimeout: () => 0, clearTimeout: () => {} };

describe("spectators › Watching a game of bots (on the device)", () => {
  it("Watch three bots: Robo, Pixel and Byte with 8 cards each, the viewer is a spectator who sees every target", () => {
    const room = LocalRoom.createWatch(3, 1, quiet);
    const view = toGameView(room.state, room.roomId, room.sessionId)!;
    expect(view.seats.map((s) => [s.seat, s.name, s.cards, s.isBot])).toEqual([
      [1, "Robo", 8, true],
      [2, "Pixel", 8, true],
      [3, "Byte", 8, true],
    ]);
    expect(view).toMatchObject({ spectating: true, botOnly: true, mySeat: undefined });
    expect(view.seats.every((s) => s.target !== undefined)).toBe(true);
  });

  it("the first seat is drawn from the seed, not always seat 1", () => {
    const starts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => LocalRoom.createWatch(4, 1, { ...quiet, seed: () => seed }).game.turnSeat));
    expect(starts.size).toBeGreaterThan(1);
  });

  it("Bots play to the end: they play by themselves and one wins", () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(2, 4, { seed: () => 7, strategy: greedyBotTurn });
    for (let i = 0; i < 2000 && room.game.step !== "finished"; i++) vi.advanceTimersByTime(BOT_SHIFT_DELAY_MS);
    expect(room.game.step).toBe("finished");
    expect(room.game.winnerSeat).toBeGreaterThan(0);
  });

  it("Faster bots: the spectator sets 4×, the state says so and the pauses shrink", async () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(2, 1, { seed: () => 7 });
    expect(await room.request("setSpeed", { speed: 4 })).toEqual({ ok: true });
    expect(room.state.botSpeed).toBe(4);
    expect(await room.request("setSpeed", { speed: 3 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    // The pause already running keeps its length; the next ones are four times shorter.
    vi.advanceTimersByTime(BOT_SHIFT_DELAY_MS);
    expect(room.game.step).toBe("move");
    vi.advanceTimersByTime(BOT_MOVE_DELAY_MS / 4);
    expect(room.game.step).toBe("shift");
  });

  it("Spectator tries to move: NOT_SEATED for shift, move, autoplay and rematch", async () => {
    const room = LocalRoom.createWatch(2, 1, quiet);
    expect(await room.request("shift", { insertion: "N1", rotation: 0 })).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(await room.request("move", { row: 0, col: 0 })).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(await room.request("rematch", {})).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("Reload ends it: never saved, and the quick game slot is left alone", async () => {
    const quick = LocalRoom.create("Maija", 1, quiet);
    const room = LocalRoom.createWatch(2, 1, quiet);
    expect(loadLocalGame(room.roomId)).toBeUndefined();
    await expect(createConnector().reconnect(room.reconnectionToken)).rejects.toMatchObject({ code: 524 });
    await room.leave();
    expect(loadLocalGame(quick.roomId)?.roomId).toBe(quick.roomId);
  });

  it("No waiting for the server: the connector starts it without any network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const room = await createConnector().createBotWatch({ bots: 2, speed: 2 });
    expect(room.roomId).toMatch(/^local-watch-/);
    expect(room.state.botSpeed).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    await room.leave();
  });
});
