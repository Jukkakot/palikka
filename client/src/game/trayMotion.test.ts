import { describe, expect, it } from "vitest";
import { newlyFrozen, newlyPlaced, sameTray, type TraySnapshot } from "./trayMotion.ts";

const snap = (colour: number, fits: number[] | undefined, placed: number[] = []): TraySnapshot => ({
  colour,
  fits: fits && new Set(fits),
  placed: new Set(placed),
});

describe("piece-controls › Piece tray (motion)", () => {
  it("Piece lost to another move: a piece that fitted and fits nowhere now freezes", () => {
    expect([...newlyFrozen(snap(1, [1, 2, 3]), snap(1, [1, 3]))]).toEqual([2]);
  });

  it("a colour switch never animates", () => {
    expect(newlyFrozen(snap(1, [1, 2, 3]), snap(3, [1])).size).toBe(0);
    expect(newlyPlaced(snap(1, [1], [4]), snap(3, [1], [4, 5])).size).toBe(0);
  });

  it("a placed piece does not freeze; its slot fades", () => {
    const before = snap(1, [1, 2, 3]);
    const after = snap(1, [1, 3], [2]);
    expect(newlyFrozen(before, after).size).toBe(0);
    expect([...newlyPlaced(before, after)]).toEqual([2]);
  });

  it("nothing freezes at first sight or without the fitting set", () => {
    expect(newlyFrozen(undefined, snap(1, [1])).size).toBe(0);
    expect(newlyFrozen(snap(1, undefined), snap(1, [1])).size).toBe(0);
  });

  it("snapshots compare by content", () => {
    expect(sameTray(snap(1, [1, 2], [3]), snap(1, [2, 1], [3]))).toBe(true);
    expect(sameTray(snap(1, [1, 2]), snap(1, [1]))).toBe(false);
    expect(sameTray(snap(1, undefined), snap(1, undefined))).toBe(true);
  });
});
