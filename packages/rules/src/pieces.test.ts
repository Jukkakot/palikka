import { describe, expect, it } from "vitest";
import {
  distinctOrientations,
  mirrorOrientation,
  mirrorShape,
  ORIENTATIONS,
  PIECE_IDS,
  PIECE_SIZES,
  pieceNumber,
  rotateShape,
  SET_SQUARES,
  shapeKey,
  turnOrientation,
} from "./pieces.js";

const orientationKeys = (piece: number) => ORIENTATIONS[piece]!.map((o) => shapeKey(o.cells));

describe("pieces › Piece set", () => {
  it("Counting the set: 21 pieces, sizes 1×1, 1×2, 2×3, 5×4, 12×5, 89 squares", () => {
    expect(PIECE_IDS).toHaveLength(21);
    const bySize = new Map<number, number>();
    for (const size of PIECE_SIZES) bySize.set(size, (bySize.get(size) ?? 0) + 1);
    expect(Object.fromEntries(bySize)).toEqual({ 1: 1, 2: 1, 3: 2, 4: 5, 5: 12 });
    expect(SET_SQUARES).toBe(89);
  });

  it("No duplicate shapes: no two pieces share an orientation", () => {
    const owner = new Map<string, number>();
    ORIENTATIONS.forEach((_, piece) => {
      for (const key of orientationKeys(piece)) {
        expect(owner.get(key), `${PIECE_IDS[piece]} vs ${owner.get(key)}`).toBeUndefined();
        owner.set(key, piece);
      }
    });
  });

  it("ids follow the size of the piece", () => {
    PIECE_IDS.forEach((id, piece) => expect(Number(id[1])).toBe(PIECE_SIZES[piece]));
  });
});

describe("pieces › Orientations", () => {
  it("Symmetric pieces: I1, O4 and X5 have one orientation each", () => {
    for (const id of ["I1", "O4", "X5"]) expect(ORIENTATIONS[pieceNumber(id)]).toHaveLength(1);
  });

  it("Asymmetric piece: F5 has 8 distinct orientations", () => {
    expect(ORIENTATIONS[pieceNumber("F5")]).toHaveLength(8);
  });

  it("Total orientations: 91, each piece 1, 2, 4 or 8", () => {
    expect(ORIENTATIONS.flat()).toHaveLength(91);
    for (const list of ORIENTATIONS) expect([1, 2, 4, 8]).toContain(list.length);
  });

  it("Every orientation is the same piece: closed under rotate and mirror", () => {
    ORIENTATIONS.forEach((list, piece) => {
      const keys = new Set(orientationKeys(piece));
      for (const { cells } of list) {
        expect(keys.has(shapeKey(rotateShape(cells)))).toBe(true);
        expect(keys.has(shapeKey(mirrorShape(cells)))).toBe(true);
      }
    });
  });

  it("orientation data is consistent (index, row masks, bounding box)", () => {
    ORIENTATIONS.forEach((list, piece) =>
      list.forEach((o, index) => {
        expect(o.piece).toBe(piece);
        expect(o.index).toBe(index);
        expect(o.rows).toHaveLength(o.height);
        const bits = o.rows.reduce((n, mask) => n + mask.toString(2).replace(/0/g, "").length, 0);
        expect(bits).toBe(o.cells.length);
        expect(Math.max(...o.cells.map(([, c]) => c)) + 1).toBe(o.width);
        expect(distinctOrientations(o.cells).map(shapeKey)).toEqual(orientationKeys(piece));
      }),
    );
  });

  it("golden orientations (indexes are stable)", () => {
    const text = ORIENTATIONS.map((list, piece) => `${PIECE_IDS[piece]}: ${list.map((o) => shapeKey(o.cells)).join(" | ")}`);
    expect(text.join("\n")).toMatchSnapshot();
  });
});

describe("pieces › Turning and mirroring an orientation", () => {
  const each = (check: (piece: number, index: number) => void) =>
    ORIENTATIONS.forEach((list, piece) => list.forEach((o) => check(piece, o.index)));

  it("the turned and mirrored index is the transformed shape", () => {
    each((piece, index) => {
      const cells = ORIENTATIONS[piece]![index]!.cells;
      expect(shapeKey(ORIENTATIONS[piece]![turnOrientation(piece, index)]!.cells)).toBe(shapeKey(rotateShape(cells)));
      expect(shapeKey(ORIENTATIONS[piece]![mirrorOrientation(piece, index)]!.cells)).toBe(shapeKey(mirrorShape(cells)));
    });
  });

  it("Four quarter turns: back to the start", () => {
    each((piece, index) => {
      let o = index;
      for (let i = 0; i < 4; i++) o = turnOrientation(piece, o);
      expect(o).toBe(index);
    });
  });

  it("Mirror twice: back to the start", () => {
    each((piece, index) => expect(mirrorOrientation(piece, mirrorOrientation(piece, index))).toBe(index));
  });

  it("Symmetric piece: X5 stays in its only orientation", () => {
    const x = pieceNumber("X5");
    expect(turnOrientation(x, 0)).toBe(0);
    expect(mirrorOrientation(x, 0)).toBe(0);
  });
});
