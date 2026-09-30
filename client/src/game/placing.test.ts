import { checkPlacement, CLASSIC, newPosition, ORIENTATIONS, pieceNumber } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { aimOf, hintMoves, legalMovesOf, movesCovering, piecesCovering, previewAt, referenceCell, squaresOf } from "./placing.ts";

const I3 = pieceNumber("I3");
/** The flat orientation of a piece: one row. */
const flat = (piece: number) => ORIENTATIONS[piece]!.findIndex((o) => o.height === 1);

describe("piece-controls › Placement preview", () => {
  it("reference square: the cell nearest the middle", () => {
    expect(referenceCell(I3, flat(I3))).toEqual([0, 1]);
    expect(referenceCell(pieceNumber("I1"), 0)).toEqual([0, 0]);
    expect(referenceCell(pieceNumber("X5"), 0)).toEqual([1, 1]);
  });

  it("Snap to a legal spot: I3 flat, tapping the third top square covers the corner", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const preview = previewAt(position, 1, { piece: I3, orientation: flat(I3), square: 2, snap: true });
    expect(preview.legal).toBe(true);
    expect(preview.squares.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("snapping prefers the spot whose reference square is nearest", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    // Only one I3-flat spot covers the corner; pointing at the corner itself snaps there too.
    const preview = previewAt(position, 1, { piece: I3, orientation: flat(I3), square: 0, snap: true });
    expect(preview.move).toMatchObject({ row: 0, col: 0 });
  });

  it("No legal spot: the preview stays at the square with the rules' reason", () => {
    const position = positionWith([[1, placement("L5", ["####", "#..."], 0, 0)]], [1, 2]);
    const square = 10 * 20 + 10;
    const preview = previewAt(position, 1, { piece: I3, orientation: flat(I3), square, snap: true });
    expect(preview.legal).toBe(false);
    expect(preview.reason).toBe("NO_CORNER_CONTACT");
    expect(preview.squares).toContain(square);
  });

  it("exact aims are clamped inside the board", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const preview = previewAt(position, 1, { piece: I3, orientation: flat(I3), square: 19, snap: false });
    expect(preview.move).toMatchObject({ row: 0, col: 17 });
    expect(preview.reason).toBe("NOT_ON_START");
  });

  it("every legal move of a group is legal and of that piece and orientation", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const moves = legalMovesOf(position, 1, pieceNumber("L5"), 0);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move).toMatchObject({ piece: pieceNumber("L5"), orientation: 0 });
      expect(checkPlacement(position, 1, move)).toBeUndefined();
    }
  });

  it("aimOf shows exactly the move", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    for (let o = 0; o < 8; o++) {
      for (const move of legalMovesOf(position, 1, pieceNumber("F5"), o)) expect(previewAt(position, 1, aimOf(move, 20)).move).toEqual(move);
    }
  });
});

describe("piece-controls › Corner first (model)", () => {
  it("the moves covering a square, and the pieces that have one", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const moves = movesCovering(position, 1, 0);
    expect(moves.length).toBeGreaterThan(21);
    for (const m of moves) expect(squaresOf(m, 20)).toContain(0);
    expect(piecesCovering(position, 1, 0).size).toBe(20); // all but X5
    expect(movesCovering(position, 1, 0, I3).every((m) => m.piece === I3)).toBe(true);
    expect(piecesCovering(position, 1, 210).size).toBe(0);
  });
});

describe("piece-controls › Dragging a piece (near snap)", () => {
  const position = newPosition(CLASSIC, [1, 2], 1);
  const o = flat(I3);

  it("snaps to a legal spot at most one square away", () => {
    // I3 flat's legal spot on the corner has its reference square at (0,1); aimed at (1,2).
    const preview = previewAt(position, 1, { piece: I3, orientation: o, square: 22, snap: true, near: true });
    expect(preview.legal).toBe(true);
    expect(preview.squares).toEqual([0, 1, 2]);
  });

  it("No far jumps: three squares away the spot is under the piece and illegal", () => {
    const preview = previewAt(position, 1, { piece: I3, orientation: o, square: 3 * 20 + 4, snap: true, near: true });
    expect(preview.legal).toBe(false);
    expect(preview.squares).toEqual([63, 64, 65]);
    expect(preview.reason).toBe("NOT_ON_START");
  });
});

describe("piece-controls › Hint as a preview", () => {
  it("Hint: a legal move, the same within a turn", () => {
    const position = newPosition(CLASSIC, [1, 2], 1);
    const moves = hintMoves(position, 1, 1);
    expect(moves).toHaveLength(3);
    for (const move of moves) {
      expect(checkPlacement(position, 1, move)).toBeUndefined();
      expect(squaresOf(move, 20)).toContain(0);
    }
    expect(hintMoves(position, 1, 1)).toEqual(moves);
  });

  it("Hint for the shared colour: a legal colour-4 move chosen for the viewer's side", () => {
    const position = { ...newPosition(CLASSIC, [1, 2, 3, 4], 4, { 1: 1, 2: 2, 3: 3, 4: 0 }) };
    const [move] = hintMoves(position, 4, 4, 2);
    expect(checkPlacement(position, 4, move!)).toBeUndefined();
    expect(hintMoves(position, 4, 4, 2)[0]).toEqual(move);
  });
});
