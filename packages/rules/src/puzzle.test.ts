import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PIECE_SIZES, pieceNumber } from "./pieces.js";
import { dailyPuzzle, puzzleFits, puzzlePieceCount, puzzleSolved, puzzleSquares, type Puzzle } from "./puzzle.js";

const isoDate = (day: number) => new Date(Date.UTC(2020, 0, 1) + day * 86_400_000).toISOString().slice(0, 10);

function connected(puzzle: Puzzle): boolean {
  const { size, shape } = puzzle;
  const inShape = new Set(shape);
  const seen = new Set([shape[0]!]);
  const stack = [shape[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
      const n = nr * size + nc;
      if (nr >= 0 && nc >= 0 && nr < size && nc < size && inShape.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === shape.length;
}

/** An empty square not reachable from outside the board through empty squares. */
function hasHole(puzzle: Puzzle): boolean {
  const { size, shape } = puzzle;
  const inShape = new Set(shape);
  const n = size + 2;
  const at = (r: number, c: number) => r >= 1 && c >= 1 && r <= size && c <= size && inShape.has((r - 1) * size + c - 1);
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
      const k = nr * n + nc;
      if (nr >= 0 && nc >= 0 && nr < n && nc < n && !at(nr, nc) && !seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  return seen.size + shape.length !== n * n;
}

function checkSolvable(puzzle: Puzzle) {
  const placed = [];
  for (const move of puzzle.solution) {
    expect(puzzleFits(puzzle, placed, move)).toBeUndefined();
    placed.push(move);
  }
  expect(puzzleSolved(puzzle, placed)).toBe(true);
  expect(new Set(placed.flatMap((p) => puzzleSquares(puzzle, p)))).toEqual(new Set(puzzle.shape));
}

describe("daily-puzzle › One puzzle per day", () => {
  it("Same date, same puzzle", () => {
    expect(dailyPuzzle("2026-10-01")).toEqual(dailyPuzzle("2026-10-01"));
  });

  it("Next day differs", () => {
    const a = dailyPuzzle("2026-10-01");
    const b = dailyPuzzle("2026-10-02");
    expect(a.shape.join() === b.shape.join() && a.pieces.join() === b.pieces.join()).toBe(false);
  });

  it("Sunday is the hardest", () => {
    const sunday = dailyPuzzle("2026-10-04");
    expect(sunday.pieces).toHaveLength(8);
    expect(sunday.pieces.filter((p) => PIECE_SIZES[p] === 5)).toHaveLength(6);
    expect(sunday.pieces.filter((p) => PIECE_SIZES[p]! < 5).every((p) => PIECE_SIZES[p]! >= 3)).toBe(true);
  });

  it("piece counts follow the weekday, Monday 5 to Sunday 8", () => {
    // 2026-09-28 is a Monday.
    const counts = [28, 29, 30].map((d) => puzzlePieceCount(`2026-09-${d}`));
    counts.push(...[1, 2, 3, 4].map((d) => puzzlePieceCount(`2026-10-0${d}`)));
    expect(counts).toEqual([5, 5, 6, 6, 7, 7, 8]);
  });

  it("refuses a string that is not a date", () => {
    expect(() => dailyPuzzle("2026-02-30")).toThrow(RangeError);
    expect(() => dailyPuzzle("tomorrow")).toThrow(RangeError);
  });

  it("Always solvable (random dates 2020–2040): the solution covers a connected, hole-free shape", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7300 }), (day) => {
        const puzzle = dailyPuzzle(isoDate(day));
        checkSolvable(puzzle);
        expect(puzzle.shape.length).toBe(puzzle.pieces.reduce((sum, p) => sum + PIECE_SIZES[p]!, 0));
        expect(new Set(puzzle.pieces).size).toBe(puzzle.pieces.length);
        expect(connected(puzzle)).toBe(true);
        expect(hasHole(puzzle)).toBe(false);
        expect(puzzle.size).toBeLessThanOrEqual(16);
      }),
      { numRuns: 60 },
    );
  });

  it("a year of puzzles generates within 2 s", () => {
    const start = Date.now();
    for (let day = 0; day < 365; day++) dailyPuzzle(isoDate(2200 + day));
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("daily-puzzle › Filling the shape", () => {
  const puzzle = dailyPuzzle("2026-10-01");
  const [first, second] = puzzle.solution as [(typeof puzzle.solution)[0], (typeof puzzle.solution)[0]];

  it("Off the shape", () => {
    const outside = { ...first, row: -1 };
    expect(puzzleFits(puzzle, [], outside)).toBe("OFF_SHAPE");
    // Inside the board but off the shape: shift the whole solution piece until a square leaves the shape.
    const shape = new Set(puzzle.shape);
    const shifted = [1, 2, 3, 4, 5]
      .map((d) => ({ ...first, col: first.col + d }))
      .find((m) => puzzleSquares(puzzle, m).some((i) => !shape.has(i)) && m.col + 5 <= puzzle.size);
    if (shifted) expect(puzzleFits(puzzle, [], shifted)).toBe("OFF_SHAPE");
  });

  it("Overlap", () => {
    expect(puzzleFits(puzzle, [first], { ...second, row: first.row, col: first.col })).toMatch(/OVERLAP|OFF_SHAPE/);
    const onTop = puzzle.solution.find((m) => m !== first && puzzleFits(puzzle, [], { ...m, row: first.row, col: first.col }) === undefined);
    if (onTop) expect(puzzleFits(puzzle, [first], { ...onTop, row: first.row, col: first.col })).toBe("OVERLAP");
  });

  it("Piece already used", () => {
    expect(puzzleFits(puzzle, [first], first)).toBe("PIECE_USED");
    const notInPuzzle = [pieceNumber("I1"), pieceNumber("I2")].find((p) => !puzzle.pieces.includes(p))!;
    expect(puzzleFits(puzzle, [], { piece: notInPuzzle, orientation: 0, row: 0, col: 0 })).toBe("PIECE_USED");
  });

  it("is not solved until every piece is placed", () => {
    expect(puzzleSolved(puzzle, puzzle.solution.slice(1))).toBe(false);
    expect(puzzleSolved(puzzle, puzzle.solution)).toBe(true);
  });
});
