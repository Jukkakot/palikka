import { describe, expect, it } from "vitest";
import { square, type Direction } from "./geometry.js";
import { openings } from "./tile.js";
import { FIXED_LAYOUT, fixedSquareOf, TILE_SET, TREASURES, treasureOf } from "./tileSet.js";

const count = (pred: (t: (typeof TILE_SET)[number]) => boolean) => TILE_SET.filter(pred).length;

/** Openings of the fixed tile placed on `(row, col)`. */
function fixedOpenings(row: number, col: number): Direction[] {
  const id = TILE_SET.findIndex((t) => t.fixed && fixedSquareOf(t.id).row === row && fixedSquareOf(t.id).col === col);
  expect(id).toBeGreaterThanOrEqual(0);
  return openings({ id, ...FIXED_LAYOUT[id]! });
}

describe("board-setup › Tile set", () => {
  it("Tile counts", () => {
    expect(TILE_SET).toHaveLength(50);
    expect(new Set(TILE_SET.map((t) => t.id)).size).toBe(50);
    expect(count((t) => t.fixed)).toBe(16);
    expect(count((t) => t.fixed && t.kind === "corner")).toBe(4);
    expect(count((t) => t.fixed && t.kind === "tee")).toBe(12);
    expect(count((t) => !t.fixed)).toBe(34);
    expect(count((t) => !t.fixed && t.kind === "straight")).toBe(12);
    expect(count((t) => !t.fixed && t.kind === "corner")).toBe(16);
    expect(count((t) => !t.fixed && t.kind === "tee")).toBe(6);
  });

  it("ids follow the catalogue layout of the design", () => {
    expect(TILE_SET.map((t) => t.id)).toEqual([...Array(50).keys()]);
    expect([0, 3, 12, 15].map((id) => TILE_SET[id]!.kind)).toEqual(["corner", "corner", "corner", "corner"]);
    expect(TILE_SET.slice(16, 28).every((t) => t.kind === "straight")).toBe(true);
    expect(TILE_SET.slice(28, 44).every((t) => t.kind === "corner")).toBe(true);
    expect(TILE_SET.slice(44).every((t) => t.kind === "tee")).toBe(true);
  });
});

describe("board-setup › Treasures", () => {
  it("Treasure placement", () => {
    const withTreasure = TILE_SET.filter((t) => t.treasure);
    expect(withTreasure).toHaveLength(24);
    expect(new Set(withTreasure.map((t) => t.treasure))).toEqual(new Set(TREASURES));
    expect(count((t) => t.fixed && t.kind === "tee" && !!t.treasure)).toBe(12);
    expect(count((t) => !t.fixed && t.kind === "tee" && !!t.treasure)).toBe(6);
    expect(count((t) => !t.fixed && t.kind === "corner" && !!t.treasure)).toBe(6);
    expect(count((t) => t.kind === "straight" && !!t.treasure)).toBe(0);
    expect([0, 3, 12, 15].map(treasureOf)).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe("board-setup › Fixed layout", () => {
  it("fixed tiles sit on the fixed squares in row-major order", () => {
    expect(fixedSquareOf(0)).toEqual(square(0, 0));
    expect(fixedSquareOf(5)).toEqual(square(2, 2));
    expect(fixedSquareOf(15)).toEqual(square(6, 6));
    expect(() => fixedSquareOf(16)).toThrow(RangeError);
  });

  it("Start corners open inward", () => {
    expect(fixedOpenings(0, 0)).toEqual(["E", "S"]);
    expect(fixedOpenings(0, 6)).toEqual(["S", "W"]);
    expect(fixedOpenings(6, 6)).toEqual(["N", "W"]);
    expect(fixedOpenings(6, 0)).toEqual(["N", "E"]);
  });

  it("Edge T-junctions closed toward the edge", () => {
    const closed = (row: number, col: number) =>
      (["N", "E", "S", "W"] as const).filter((d) => !fixedOpenings(row, col).includes(d));
    expect([closed(0, 2), closed(0, 4)]).toEqual([["N"], ["N"]]);
    expect([closed(2, 6), closed(4, 6)]).toEqual([["E"], ["E"]]);
    expect([closed(6, 2), closed(6, 4)]).toEqual([["S"], ["S"]]);
    expect([closed(2, 0), closed(4, 0)]).toEqual([["W"], ["W"]]);
  });

  it("Inner T-junctions", () => {
    expect(fixedOpenings(2, 2)).toEqual(["N", "E", "S"]); // closed W
    expect(fixedOpenings(2, 4)).toEqual(["E", "S", "W"]); // closed N
    expect(fixedOpenings(4, 4)).toEqual(["N", "S", "W"]); // closed E
    expect(fixedOpenings(4, 2)).toEqual(["N", "E", "W"]); // closed S
  });
});
