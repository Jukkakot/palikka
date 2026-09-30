import { dailyPuzzle, puzzleSquares } from "@palikka/rules";
import { describe, expect, it } from "vitest";
import { aimOf } from "../game/placing.ts";
import { placementAt, puzzleColours, puzzlePreviewAt } from "./puzzlePlacing.ts";

const puzzle = dailyPuzzle("2026-10-01");
const [first, second] = puzzle.solution as [(typeof puzzle.solution)[0], (typeof puzzle.solution)[0]];

describe("puzzlePlacing", () => {
  it("an exact aim at a solution spot fits", () => {
    const preview = puzzlePreviewAt(puzzle, [], aimOf(first, puzzle.size));
    expect(preview).toMatchObject({ move: first, legal: true });
  });

  it("a pointer snaps to a fitting spot covering the square", () => {
    const square = puzzleSquares(puzzle, first)[0]!;
    const preview = puzzlePreviewAt(puzzle, [], { piece: first.piece, orientation: first.orientation, square, snap: true });
    expect(preview.legal).toBe(true);
    expect(preview.squares).toContain(square);
  });

  it("an aim off the shape shows why", () => {
    const outside = Array.from({ length: puzzle.size ** 2 }, (_, i) => i).find((i) => !puzzle.shape.includes(i))!;
    const preview = puzzlePreviewAt(puzzle, [], { piece: first.piece, orientation: first.orientation, square: outside, snap: false });
    expect(preview).toMatchObject({ legal: false, reason: "OFF_SHAPE" });
  });

  it("finds the placed piece under a square", () => {
    expect(placementAt(puzzle, [first, second], puzzleSquares(puzzle, second)[0]!)).toBe(second);
  });

  it("colours neighbouring pieces differently", () => {
    const owner = puzzleColours(puzzle, puzzle.solution);
    const size = puzzle.size;
    for (const move of puzzle.solution) {
      const own = new Set(puzzleSquares(puzzle, move));
      for (const i of own) {
        for (const n of [i - size, i + size, i % size ? i - 1 : -1, (i + 1) % size ? i + 1 : -1]) {
          if (n >= 0 && n < size * size && !own.has(n) && owner[n]) expect(owner[n]).not.toBe(owner[i]);
        }
      }
    }
  });
});
