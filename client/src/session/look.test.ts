// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { loadLocalGame, saveLocalGame } from "./localGameStore.ts";
import { LocalRoom } from "./localRoom.ts";
import { deviceLooks, loadLook, saveLook } from "./look.ts";
import { toGameView } from "./viewModel.ts";

afterEach(() => localStorage.clear());

const noTimers = { seed: () => 7, setTimeout: () => 0, clearTimeout: () => {} };

describe("pawn-looks › The player's own pawn choice", () => {
  it("Remembered: stored once picked; nothing or garbage stored means no preference", () => {
    expect(loadLook()).toBeUndefined();
    saveLook(3);
    expect(loadLook()).toBe(3);
    localStorage.setItem("labyrinth.look", "9");
    expect(loadLook()).toBeUndefined();
  });
});

describe("pawn-looks › Pawns in games on the device", () => {
  it("Device game: the player's pawn, the bots the seat's own or the lowest free", () => {
    expect(deviceLooks([1, 2, 3], 1, 2)).toEqual({ 1: 2, 2: 1, 3: 3 });
    expect(deviceLooks([1, 2, 3, 4], 1)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4 });
  });

  it("a 1v2 game shows the chosen pawns and keeps them when continued", () => {
    saveLook(2);
    const room = LocalRoom.create("Maija", 2, noTimers);
    const looks = (r: LocalRoom) => toGameView(r.state, r.roomId, r.sessionId)!.seats.map((s) => s.look);
    expect(looks(room)).toEqual([2, 1, 3]);
    saveLook(4);
    expect(looks(LocalRoom.restore(room.roomId, noTimers)!)).toEqual([2, 1, 3]);
  });

  it("an older save without pawns falls back to the seats' own", () => {
    const room = LocalRoom.create("Maija", 1, noTimers);
    const saved = loadLocalGame(room.roomId)!;
    delete saved.looks;
    saveLocalGame(saved);
    const restored = LocalRoom.restore(room.roomId, noTimers)!;
    expect(toGameView(restored.state, restored.roomId, restored.sessionId)!.seats.map((s) => s.look)).toEqual([1, 2]);
  });
});
