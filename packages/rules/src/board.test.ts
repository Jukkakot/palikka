import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { connectedNeighbours, createBoard, FIXED_SQUARES, isConnected, isFixed, START_CORNERS, tileAt } from "./board.js";
import { ALL_SQUARES, neighbour, square, squareIndex } from "./geometry.js";
import { boardFromRows, uniformBoard, withTile } from "./testing.js";
import { isOpen, openings, ROTATIONS, TILE_KINDS } from "./tile.js";

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

describe("board › Tiles on the board", () => {
  it("Tile count", () => {
    const board = uniformBoard();
    expect(board.squares).toHaveLength(49);
    const ids = new Set([...board.squares, board.spare].map((t) => t.id));
    expect(ids.size).toBe(50);
  });
});

describe("board › Fixed and movable squares", () => {
  it("Fixed square", () => {
    expect(isFixed(square(2, 4))).toBe(true);
  });

  it("Movable square", () => {
    expect(isFixed(square(2, 3))).toBe(false);
  });

  it("Counts", () => {
    expect(FIXED_SQUARES).toHaveLength(16);
    expect(ALL_SQUARES.filter((sq) => !isFixed(sq))).toHaveLength(33);
    for (const corner of START_CORNERS) expect(isFixed(corner)).toBe(true);
    expect(START_CORNERS).toEqual([square(0, 0), square(0, 6), square(6, 6), square(6, 0)]);
  });
});

describe("board › Connections between squares", () => {
  // Straight tiles turned 90° are open E and W.
  const horizontal = uniformBoard("I90");

  it("Both open", () => {
    expect(isConnected(horizontal, square(3, 3), square(3, 4))).toBe(true);
  });

  it("One side walled", () => {
    // (3,4) becomes a straight open N/S: closed toward W.
    const board = withTile(horizontal, idx(3, 4), "I0");
    expect(isOpen(tileAt(board, square(3, 3)), "E")).toBe(true);
    expect(isConnected(board, square(3, 3), square(3, 4))).toBe(false);
  });

  it("Open toward the edge", () => {
    const vertical = uniformBoard("I0");
    expect(isOpen(tileAt(vertical, square(0, 3)), "N")).toBe(true);
    expect(connectedNeighbours(vertical, square(0, 3))).toEqual([square(1, 3)]);
  });

  it("non-neighbours are never connected directly", () => {
    const allOpen = uniformBoard("T0");
    expect(isConnected(allOpen, square(3, 3), square(3, 5))).toBe(false);
    expect(isConnected(allOpen, square(3, 3), square(4, 4))).toBe(false);
  });

  it("Connected neighbours of a square (property): exactly the neighbours satisfying the rule", () => {
    fc.assert(
      fc.property(boardArb, fc.constantFrom(...ALL_SQUARES), (board, sq) => {
        const expected = (["N", "E", "S", "W"] as const).flatMap((dir) => {
          const n = neighbour(sq, dir);
          const back = ({ N: "S", E: "W", S: "N", W: "E" } as const)[dir];
          return n && isOpen(tileAt(board, sq), dir) && isOpen(tileAt(board, n), back) ? [n] : [];
        });
        expect(connectedNeighbours(board, sq)).toEqual(expected);
      }),
    );
  });

  it("property: connection is symmetric", () => {
    fc.assert(
      fc.property(boardArb, fc.constantFrom(...ALL_SQUARES), fc.constantFrom(...ALL_SQUARES), (board, a, b) => {
        expect(isConnected(board, a, b)).toBe(isConnected(board, b, a));
      }),
    );
  });
});

describe("board › Board construction from a layout", () => {
  it("Valid layout", () => {
    const board = boardFromRows(
      [
        "L90 I0 T0 I0 T0 I0 L180",
        "I0 I0 I0 I0 I0 I0 I0",
        "T270 I0 T270 I0 T0 I0 T90",
        "I0 I0 I0 I0 I0 I0 I0",
        "T270 I0 T180 I0 T90 I0 T90",
        "I0 I0 I0 I0 I0 I0 I0",
        "L0 I0 T180 I0 T180 I0 L270",
      ],
      "L0",
    );
    expect(tileAt(board, square(0, 0))).toEqual({ id: 0, kind: "corner", rotation: 90 });
    expect(openings(tileAt(board, square(0, 0)))).toEqual(["E", "S"]);
    expect(tileAt(board, square(6, 6))).toEqual({ id: 48, kind: "corner", rotation: 270 });
    expect(board.spare).toEqual({ id: 49, kind: "corner", rotation: 0 });
  });

  it("Duplicate id", () => {
    const board = uniformBoard();
    const squares = board.squares.map((t, i) => (i === 10 ? { ...t, id: 3 } : t));
    expect(() => createBoard({ squares, spare: board.spare })).toThrow(/Duplicate tile id 3/);
  });

  it("Missing square", () => {
    const board = uniformBoard();
    expect(() => createBoard({ squares: board.squares.slice(0, 48), spare: board.spare })).toThrow(/49 squares/);
  });

  it("rejects invalid kinds and rotations", () => {
    const board = uniformBoard();
    const bad = (patch: object) => board.squares.map((t, i) => (i === 0 ? { ...t, ...patch } : t));
    expect(() => createBoard({ squares: bad({ kind: "cross" }) as never, spare: board.spare })).toThrow(/kind/);
    expect(() => createBoard({ squares: bad({ rotation: 45 }) as never, spare: board.spare })).toThrow(/rotation/);
  });

  it("Round trip (property): JSON serialization restores an equal board", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        expect(createBoard(JSON.parse(JSON.stringify(board)))).toEqual(board);
      }),
    );
  });

  it("boards are immutable values", () => {
    const board = uniformBoard();
    expect(Object.isFrozen(board)).toBe(true);
    expect(Object.isFrozen(board.squares)).toBe(true);
    expect(Object.isFrozen(board.squares[0])).toBe(true);
  });
});
