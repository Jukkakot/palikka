import { checkPlacement, CLASSIC, legalMoves, newPosition, PIECE_SIZES } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { hintSquares, interimMoves, squaresOf } from "./interimMoves.ts";

describe("game-room › Interim move control", () => {
  it("First move: only the start corner, with a five-square piece covering it", () => {
    const moves = interimMoves(newPosition(CLASSIC, [1, 2], 1), 1);
    expect([...moves.keys()]).toEqual([0]);
    const move = moves.get(0)!;
    expect(PIECE_SIZES[move.piece]).toBe(5);
    expect(squaresOf(move, 20)).toContain(0);
  });

  it("Other squares: only free corners are tappable; each move is legal, covers its square and is a largest fit", () => {
    const position = positionWith([[1, placement("L5", ["####", "#..."], 0, 0)]], [1, 2]);
    const moves = interimMoves(position, 1);
    expect([...moves.keys()].sort((a, b) => a - b)).toEqual([1 * 20 + 4, 2 * 20 + 1]);
    const all = legalMoves(position, 1);
    for (const [square, move] of moves) {
      expect(checkPlacement(position, 1, move)).toBeUndefined();
      expect(squaresOf(move, 20)).toContain(square);
      expect(PIECE_SIZES[move.piece]).toBe(5);
    }
    expect(all.length).toBeGreaterThan(moves.size);
  });

  it("Hint: the squares of the bot's move, the same within a turn", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const hint = hintSquares(position, 1, 1);
    expect(hint).toContain(0);
    expect(hintSquares(position, 1, 1)).toEqual(hint);
  });
});
