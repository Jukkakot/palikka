import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createBoard, isConnected } from "./board.js";
import { ALL_SQUARES, square, squareIndex } from "./geometry.js";
import { isReachable, reachableSquares, shortestPath } from "./move.js";
import { MAX_SEED } from "./rng.js";
import { setupBoard } from "./setup.js";
import { uniformBoard, withTile } from "./testing.js";
import { ROTATIONS, TILE_KINDS } from "./tile.js";

const idx = (row: number, col: number) => squareIndex(square(row, col));

/** Random valid boards: any kinds and rotations, ids 0…49. */
const boardArb = fc
  .array(fc.record({ kind: fc.constantFrom(...TILE_KINDS), rotation: fc.constantFrom(...ROTATIONS) }), {
    minLength: 50,
    maxLength: 50,
  })
  .map((tiles) => {
    const all = tiles.map((t, id) => ({ id, ...t }));
    return createBoard({ squares: all.slice(0, 49), spare: all[49]! });
  });
const squareArb = fc.constantFrom(...ALL_SQUARES);

describe("pawn-movement › Reachable squares", () => {
  it("Closed corridor", () => {
    // (3,3) is open to the east; its east neighbour is a vertical straight, closed to the west.
    let board = uniformBoard("I0");
    board = withTile(board, idx(3, 3), "I90");
    expect(isReachable(board, square(3, 3), square(3, 4))).toBe(false);
  });

  it("Long corridor", () => {
    // Row 1 made of horizontal straights: (1,1) → (1,2) → (1,3).
    let board = uniformBoard("I0");
    for (let col = 0; col < 7; col++) board = withTile(board, idx(1, col), "I90");
    expect(isReachable(board, square(1, 1), square(1, 3))).toBe(true);
    expect(shortestPath(board, square(1, 1), square(1, 3))).toEqual([square(1, 1), square(1, 2), square(1, 3)]);
  });

  it("Walled in", () => {
    // Vertical straights everywhere, but (3,3) is horizontal: its E/W neighbours are closed toward it.
    let board = uniformBoard("I0");
    board = withTile(board, idx(3, 3), "I90");
    expect(reachableSquares(board, square(3, 3))).toEqual([square(3, 3)]);
  });

  it("Pawns do not block: reachability depends on the board only", () => {
    // Column 2 is one straight corridor; a pawn on (3,2) cannot be expressed to the rules at all.
    const board = uniformBoard("I0");
    expect(isReachable(board, square(0, 2), square(6, 2))).toBe(true);
  });

  it("the own square comes first", () => {
    const board = uniformBoard("I0");
    const reach = reachableSquares(board, square(4, 5));
    expect(reach[0]).toEqual(square(4, 5));
    expect(reach).toHaveLength(7);
  });

  it("no path to an unreachable square", () => {
    expect(shortestPath(uniformBoard("I0"), square(0, 0), square(0, 1))).toBeUndefined();
  });

  it("property: the own square is always reachable, with a one-square path", () => {
    fc.assert(
      fc.property(boardArb, squareArb, (board, sq) => {
        expect(isReachable(board, sq, sq)).toBe(true);
        expect(shortestPath(board, sq, sq)).toEqual([sq]);
      }),
    );
  });

  it("property: reachability is symmetric", () => {
    fc.assert(
      fc.property(boardArb, squareArb, squareArb, (board, a, b) => {
        expect(isReachable(board, a, b)).toBe(isReachable(board, b, a));
      }),
    );
  });

  it("property: every path step is a connected pair and paths exist exactly for reachable squares", () => {
    fc.assert(
      fc.property(boardArb, squareArb, squareArb, (board, from, to) => {
        const path = shortestPath(board, from, to);
        expect(path !== undefined).toBe(isReachable(board, from, to));
        if (!path) return;
        expect(path[0]).toEqual(from);
        expect(path.at(-1)).toEqual(to);
        for (let i = 1; i < path.length; i++) expect(isConnected(board, path[i - 1]!, path[i]!)).toBe(true);
      }),
    );
  });

  it("property: reachable squares on real boards are exactly those with a path", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_SEED }), squareArb, (seed, from) => {
        const board = setupBoard(seed);
        const reach = new Set(reachableSquares(board, from).map(squareIndex));
        for (const sq of ALL_SQUARES) expect(reach.has(squareIndex(sq))).toBe(shortestPath(board, from, sq) !== undefined);
      }),
      { numRuns: 50 },
    );
  });
});
