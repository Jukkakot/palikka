import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIXED_SQUARES, isFixed, tileAt } from "./board.js";
import { ALL_SQUARES, squareIndex } from "./geometry.js";
import { MAX_SEED } from "./rng.js";
import { setupBoard } from "./setup.js";
import { boardToText } from "./testing.js";
import { FIXED_LAYOUT, TILE_SET, tileSpec, treasureOf } from "./tileSet.js";

const seedArb = fc.integer({ min: 0, max: MAX_SEED });

describe("board-setup › Seeded initial placement", () => {
  it("Valid board (property): all 50 tiles once, fixed tiles in their layout, movable spare", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const board = setupBoard(seed);
        const ids = [...board.squares, board.spare].map((t) => t.id).sort((a, b) => a - b);
        expect(ids).toEqual([...Array(50).keys()]);

        FIXED_SQUARES.forEach((sq, id) => {
          expect(tileAt(board, sq)).toEqual({ id, ...FIXED_LAYOUT[id] });
        });
        for (const sq of ALL_SQUARES.filter((s) => !isFixed(s))) {
          expect(tileSpec(tileAt(board, sq).id).fixed).toBe(false);
        }
        expect(tileSpec(board.spare.id).fixed).toBe(false);
        // Every tile keeps the kind of its catalogue entry.
        for (const tile of [...board.squares, board.spare]) expect(tile.kind).toBe(tileSpec(tile.id).kind);
      }),
      { numRuns: 200 },
    );
  });

  it("Reproducible", () => {
    expect(setupBoard(12345)).toEqual(setupBoard(12345));
  });

  it("Different seeds", () => {
    expect(setupBoard(1)).not.toEqual(setupBoard(2));
  });

  it("Invalid seed", () => {
    for (const seed of [-1, MAX_SEED + 1, 0.5, Number.NaN]) expect(() => setupBoard(seed)).toThrow(RangeError);
  });

  it("uses random rotations for movable tiles", () => {
    const board = setupBoard(99);
    const rotations = new Set(ALL_SQUARES.filter((s) => !isFixed(s)).map((s) => tileAt(board, s).rotation));
    expect(rotations.size).toBeGreaterThan(1);
  });

  it("golden: seed 1 always produces this board (reproducibility contract)", () => {
    // Fixed squares in brackets match the spec's fixed layout diagram:
    // row 0 ┌ ┬ ┬ ┐, row 2 ├ ├ ┬ ┤, row 4 ├ ┴ ┤ ┤, row 6 └ ┴ ┴ ┘.
    expect(boardToText(setupBoard(1))).toBe(
      [
        "[┌] ┐ [┬] ┌ [┬] ┐ [┐]",
        " ┘  ─  │  ┌  ┐  ┘  ─ ",
        "[├] ┌ [├] ├ [┬] ┐ [┤]",
        " └  │  │  ┴  ─  ─  │ ",
        "[├] ┐ [┴] ─ [┤] ┌ [┤]",
        " ├  ┌  ┬  ─  ┬  ┘  ─ ",
        "[└] ┐ [┴] ─ [┴] ┬ [┘]",
        "spare: └ (tile 40)",
      ].join("\n"),
    );
  });
});

describe("board-setup › Tile set / Fixed layout across games", () => {
  it("Same tiles every game: each id has the same kind and treasure", () => {
    const a = setupBoard(7);
    const b = setupBoard(8);
    const byId = (board: typeof a) => new Map([...board.squares, board.spare].map((t) => [t.id, t.kind]));
    expect(byId(a)).toEqual(byId(b));
    for (const t of TILE_SET) expect(treasureOf(t.id)).toBe(t.treasure);
  });

  it("Fixed layout is the same every game", () => {
    const a = setupBoard(7);
    const b = setupBoard(8);
    for (const sq of FIXED_SQUARES) expect(a.squares[squareIndex(sq)]).toEqual(b.squares[squareIndex(sq)]);
  });
});
