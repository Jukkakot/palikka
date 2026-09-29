import { describe, expect, it } from "vitest";
import { bitsToSquares, diagonalNeighbours, edgeNeighbours, emptyBits, rowMask, setBit } from "./bitboard.js";
import { CLASSIC } from "./config.js";

function bits(size: number, squares: [number, number][]) {
  const b = emptyBits(size);
  for (const [r, c] of squares) setBit(b, r, c);
  return b;
}

describe("bitboard", () => {
  it("row mask covers the board width, also at 32", () => {
    expect(rowMask(4)).toBe(0b1111);
    expect(rowMask(32) >>> 0).toBe(0xffffffff);
  });

  it("edge neighbours stay on the board at a corner", () => {
    expect(bitsToSquares(edgeNeighbours(bits(4, [[0, 0]]), 4), 4)).toEqual(["0,1", "1,0"]);
    expect(bitsToSquares(edgeNeighbours(bits(4, [[3, 3]]), 4), 4)).toEqual(["2,3", "3,2"]);
  });

  it("edge neighbours at an edge and in the middle", () => {
    expect(bitsToSquares(edgeNeighbours(bits(4, [[1, 3]]), 4), 4)).toEqual(["0,3", "1,2", "2,3"]);
    expect(bitsToSquares(edgeNeighbours(bits(4, [[1, 1]]), 4), 4)).toEqual(["0,1", "1,0", "1,2", "2,1"]);
  });

  it("diagonal neighbours stay on the board", () => {
    expect(bitsToSquares(diagonalNeighbours(bits(4, [[0, 0]]), 4), 4)).toEqual(["1,1"]);
    expect(bitsToSquares(diagonalNeighbours(bits(4, [[2, 3]]), 4), 4)).toEqual(["1,2", "3,2"]);
    expect(bitsToSquares(diagonalNeighbours(bits(4, [[1, 1]]), 4), 4)).toEqual(["0,0", "0,2", "2,0", "2,2"]);
  });

  it("the last column of a 32-wide board works", () => {
    expect(bitsToSquares(edgeNeighbours(bits(32, [[0, 31]]), 32), 32)).toEqual(["0,30", "1,31"]);
    expect(bitsToSquares(diagonalNeighbours(bits(32, [[0, 31]]), 32), 32)).toEqual(["1,30"]);
  });

  it("Two colours on the classic board: colour 1 top-left, colour 3 bottom-right", () => {
    expect(CLASSIC.size).toBe(20);
    expect(CLASSIC.starts[1]).toEqual({ row: 0, col: 0 });
    expect(CLASSIC.starts[2]).toEqual({ row: 0, col: 19 });
    expect(CLASSIC.starts[3]).toEqual({ row: 19, col: 19 });
    expect(CLASSIC.starts[4]).toEqual({ row: 19, col: 0 });
  });
});
