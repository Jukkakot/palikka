import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIXED_SQUARES, tileAt } from "./board.js";
import { ALL_SQUARES, square, squareIndex } from "./geometry.js";
import { MAX_SEED } from "./rng.js";
import { setupBoard } from "./setup.js";
import { INSERTIONS, insertionLine, isInsertionId, reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { ROTATIONS } from "./tile.js";

const board = setupBoard(42);
const at = (row: number, col: number) => tileAt(board, square(row, col));

const seedArb = fc.integer({ min: 0, max: MAX_SEED });
const insertionArb = fc.constantFrom(...INSERTIONS);
const rotationArb = fc.constantFrom(...ROTATIONS);

describe("tile-shift › Insertion points", () => {
  it("Twelve points", () => {
    expect([...INSERTIONS]).toEqual(["N1", "N3", "N5", "E1", "E3", "E5", "S1", "S3", "S5", "W1", "W3", "W5"]);
  });

  it("Fixed line cannot be pushed", () => {
    expect(isInsertionId("N2")).toBe(false);
    expect(() => shiftBoard(board, "N2" as InsertionId, 0)).toThrow(/Not an insertion point/);
  });

  it("lines run from the entry square to the exit square", () => {
    expect(insertionLine("N3")[0]).toEqual(square(0, 3));
    expect(insertionLine("N3")[6]).toEqual(square(6, 3));
    expect(insertionLine("E5")[0]).toEqual(square(5, 6));
    expect(insertionLine("W1")[6]).toEqual(square(1, 6));
  });
});

describe("tile-shift › Shifting a line", () => {
  it("Push a column down", () => {
    const { board: next, pushedOut } = shiftBoard(board, "N1", 90);
    expect(tileAt(next, square(0, 1))).toEqual({ ...board.spare, rotation: 90 });
    for (let r = 0; r <= 5; r++) expect(tileAt(next, square(r + 1, 1))).toEqual(at(r, 1));
    expect(next.spare).toEqual(at(6, 1));
    expect(pushedOut).toEqual(at(6, 1));
    for (const sq of ALL_SQUARES.filter((s) => s.col !== 1)) expect(tileAt(next, sq)).toEqual(tileAt(board, sq));
  });

  it("Push a row left", () => {
    const { board: next } = shiftBoard(board, "E3", board.spare.rotation);
    expect(tileAt(next, square(3, 6))).toEqual(board.spare);
    for (let c = 1; c <= 6; c++) expect(tileAt(next, square(3, c - 1))).toEqual(at(3, c));
    expect(next.spare).toEqual(at(3, 0));
  });

  it("Fixed tiles never move (property)", () => {
    fc.assert(
      fc.property(seedArb, insertionArb, rotationArb, (seed, id, rotation) => {
        const before = setupBoard(seed);
        const after = shiftBoard(before, id, rotation).board;
        for (const sq of FIXED_SQUARES) expect(tileAt(after, sq)).toEqual(tileAt(before, sq));
      }),
    );
  });

  it("property: every tile id is preserved", () => {
    fc.assert(
      fc.property(seedArb, insertionArb, rotationArb, (seed, id, rotation) => {
        const after = shiftBoard(setupBoard(seed), id, rotation).board;
        const ids = [...after.squares, after.spare].map((t) => t.id).sort((a, b) => a - b);
        expect(ids).toEqual([...Array(50).keys()]);
      }),
    );
  });
});

describe("tile-shift › Pawns ride the shift", () => {
  it("Pawn moves with its tile", () => {
    expect(shiftBoard(board, "N3", 0, [square(2, 3)]).pawns).toEqual([square(3, 3)]);
  });

  it("Pawn wraps around", () => {
    expect(shiftBoard(board, "N3", 0, [square(6, 3)]).pawns).toEqual([square(0, 3)]);
  });

  it("pawns off the line stay put", () => {
    expect(shiftBoard(board, "N3", 0, [square(2, 2), square(0, 0)]).pawns).toEqual([square(2, 2), square(0, 0)]);
  });
});

describe("tile-shift › No pushing straight back", () => {
  it("reverse pairs", () => {
    expect(reverseOf("N1")).toBe("S1");
    expect(reverseOf("S1")).toBe("N1");
    expect(reverseOf("E3")).toBe("W3");
    expect(reverseOf("W5")).toBe("E5");
    for (const id of INSERTIONS) expect(reverseOf(reverseOf(id))).toBe(id);
  });

  it("property: shift then reverse with the pushed-out tile restores board and pawns", () => {
    const pawnsArb = fc.array(fc.constantFrom(...ALL_SQUARES), { maxLength: 4 });
    fc.assert(
      fc.property(seedArb, insertionArb, pawnsArb, (seed, id, pawns) => {
        const before = setupBoard(seed);
        const once = shiftBoard(before, id, before.spare.rotation, pawns);
        const back = shiftBoard(once.board, reverseOf(id), once.pushedOut.rotation, once.pawns);
        expect(back.board).toEqual(before);
        expect(back.pawns).toEqual(pawns);
      }),
    );
  });

  it("the square index helper agrees with the line", () => {
    expect(insertionLine("W3").map(squareIndex)).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });
});
