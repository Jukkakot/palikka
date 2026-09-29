import { describe, expect, it } from "vitest";
import { loadSeenTips, pickTip, resetTips, saveSeenTips, type TipId, type TipSituation } from "./tips.ts";

const playing: TipSituation = { playing: true, isMyTurn: false, step: "shift", heading: "treasure" };
const seen = (...tips: TipId[]) => new Set(tips);

/** A Map-backed Storage for tests. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
} as unknown as Storage;

describe("first-game-tips › One-time tips in the first game", () => {
  it("First turn: the target tip comes first, then push on the own shift step", () => {
    const myShift = { ...playing, isMyTurn: true };
    expect(pickTip(myShift, seen())).toBe("target");
    expect(pickTip(myShift, seen("target"))).toBe("push");
  });

  it("Walk on the own move step, nothing on another player's turn once the target is known", () => {
    expect(pickTip({ ...playing, isMyTurn: true, step: "move" }, seen("target", "push"))).toBe("walk");
    expect(pickTip(playing, seen("target"))).toBeUndefined();
  });

  it("Heading home: the home tip", () => {
    expect(pickTip({ ...playing, heading: "home" }, seen("target"))).toBe("home");
  });

  it("Shown only once: nothing when every tip was seen", () => {
    expect(pickTip({ ...playing, isMyTurn: true }, seen("target", "push", "walk", "home"))).toBeUndefined();
  });

  it("Spectator or finished game: no tip", () => {
    expect(pickTip({ ...playing, playing: false, isMyTurn: true }, seen())).toBeUndefined();
  });

  it("Seen tips round-trip through storage; blocked or garbage storage gives none", () => {
    const storage = memoryStorage();
    saveSeenTips(seen("target", "push"), storage);
    expect(loadSeenTips(storage)).toEqual(seen("target", "push"));
    storage.setItem("labyrinth.tips.seen", "{not json");
    expect(loadSeenTips(storage)).toEqual(seen());
    storage.setItem("labyrinth.tips.seen", '["walk","bogus"]');
    expect(loadSeenTips(storage)).toEqual(seen("walk"));
    expect(loadSeenTips(blocked)).toEqual(seen());
    expect(() => saveSeenTips(seen("walk"), blocked)).not.toThrow();
  });
});

describe("first-game-tips › Show the tips again", () => {
  it("Resetting forgets every seen tip", () => {
    const storage = memoryStorage();
    saveSeenTips(seen("target"), storage);
    resetTips(storage);
    expect(loadSeenTips(storage)).toEqual(seen());
    expect(() => resetTips(blocked)).not.toThrow();
  });
});
