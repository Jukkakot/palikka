import { describe, expect, it } from "vitest";
import { loadSeenTips, pickTip, resetTips, saveSeenTips, type TipId, type TipSituation } from "./tips.ts";

const playing: TipSituation = { playing: true, isMyTurn: false };
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
  it("First turn: the goal tip comes first, then how to place on the own turn", () => {
    const myTurn = { ...playing, isMyTurn: true };
    expect(pickTip(myTurn, seen())).toBe("goal");
    expect(pickTip(myTurn, seen("goal"))).toBe("place");
  });

  it("Nothing on another player's turn once the goal was seen", () => {
    expect(pickTip(playing, seen("goal"))).toBeUndefined();
  });

  it("Shown only once: nothing when every tip was seen", () => {
    expect(pickTip({ ...playing, isMyTurn: true }, seen("goal", "place"))).toBeUndefined();
  });

  it("Spectator or finished game: no tip", () => {
    expect(pickTip({ ...playing, playing: false, isMyTurn: true }, seen())).toBeUndefined();
  });

  it("Seen tips round-trip through storage; blocked or garbage storage gives none", () => {
    const storage = memoryStorage();
    saveSeenTips(seen("goal", "place"), storage);
    expect(loadSeenTips(storage)).toEqual(seen("goal", "place"));
    storage.setItem("palikka.tips.seen", "{not json");
    expect(loadSeenTips(storage)).toEqual(seen());
    storage.setItem("palikka.tips.seen", '["place","bogus"]');
    expect(loadSeenTips(storage)).toEqual(seen("place"));
    expect(loadSeenTips(blocked)).toEqual(seen());
    expect(() => saveSeenTips(seen("place"), blocked)).not.toThrow();
  });
});

describe("first-game-tips › Show the tips again", () => {
  it("Resetting forgets every seen tip", () => {
    const storage = memoryStorage();
    saveSeenTips(seen("goal"), storage);
    resetTips(storage);
    expect(loadSeenTips(storage)).toEqual(seen());
    expect(() => resetTips(blocked)).not.toThrow();
  });
});
