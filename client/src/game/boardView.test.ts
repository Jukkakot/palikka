import { CLASSIC, DUO, mirrorShape, normaliseShape, ORIENTATIONS, PIECE_COUNT, shapeKey, type ShapeCell } from "@palikka/rules";
import { describe, expect, it } from "vitest";
import { boardDirection, boardOrientation, mirrorOnScreen, screenCell, screenOrientation, toBoard, toScreen, turnOnScreen, turnsFor, zoomBox, type ViewTransform } from "./boardView.ts";

const VIEWS: ViewTransform[] = [{ turns: 0 }, { turns: 1 }, { turns: 2 }, { turns: 3 }];

/** How an orientation placed at the top-left of a 20×20 board looks on screen, normalised. */
function seen(piece: number, orientation: number, view: ViewTransform): ShapeCell[] {
  return normaliseShape(
    ORIENTATIONS[piece]![orientation]!.cells.map(([r, c]): ShapeCell => {
      const s = toScreen((r + 5) * 20 + c + 5, 20, view);
      return [Math.floor(s / 20), s % 20];
    }),
  );
}

describe("piece-controls › Board turned to the player on a phone (view transform)", () => {
  it("screen and board indexes round-trip for all four turns", () => {
    for (const view of VIEWS) {
      for (let square = 0; square < 400; square++) expect(toBoard(toScreen(square, 20, view), 20, view)).toBe(square);
    }
    expect(toScreen(0, 20, { turns: 1 })).toBe(19);
    expect(toScreen(0, 20, { turns: 2 })).toBe(399);
  });

  it("a piece looks on screen like its screen orientation, and boardOrientation undoes it", () => {
    for (const view of VIEWS) {
      for (let piece = 0; piece < PIECE_COUNT; piece++) {
        for (const o of ORIENTATIONS[piece]!) {
          const shown = screenOrientation(piece, o.index, view);
          expect(shapeKey(seen(piece, o.index, view))).toBe(shapeKey(ORIENTATIONS[piece]![shown]!.cells));
          expect(boardOrientation(piece, shown, view)).toBe(o.index);
        }
      }
    }
  });

  it("screenCell: the board orientation's cell lands where the view puts it", () => {
    for (const view of VIEWS) {
      for (let piece = 0; piece < PIECE_COUNT; piece++) {
        for (const o of ORIENTATIONS[piece]!) {
          for (const cell of o.cells) {
            const { orientation, ref } = screenCell(piece, o.index, cell, view);
            expect(orientation).toBe(screenOrientation(piece, o.index, view));
            // Placed at (5,5): the cell's screen square, relative to the shape's screen box.
            const shape = o.cells.map(([r, c]) => toScreen((r + 5) * 20 + c + 5, 20, view));
            const top = Math.min(...shape.map((s) => Math.floor(s / 20)));
            const left = Math.min(...shape.map((s) => s % 20));
            const s = toScreen((cell[0] + 5) * 20 + cell[1] + 5, 20, view);
            expect(ref).toEqual([Math.floor(s / 20) - top, (s % 20) - left]);
          }
        }
      }
    }
  });

  it("Käännä turns clockwise and Peilaa mirrors left to right as seen", () => {
    for (const view of VIEWS) {
      for (let piece = 0; piece < PIECE_COUNT; piece++) {
        for (const o of ORIENTATIONS[piece]!) {
          const mirrored = seen(piece, mirrorOnScreen(piece, o.index, view), view);
          expect(shapeKey(mirrored)).toBe(shapeKey(mirrorShape(seen(piece, o.index, view))));
          const turned = seen(piece, turnOnScreen(piece, o.index), view);
          const expected = normaliseShape(seen(piece, o.index, view).map(([r, c]): ShapeCell => [c, -r]));
          expect(shapeKey(turned)).toBe(shapeKey(expected));
        }
      }
    }
  });

  it("the arrow keys move in screen directions", () => {
    for (const view of VIEWS) {
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const [br, bc] = boardDirection(dr, dc, view);
        const from = 10 * 20 + 10;
        const to = toScreen((10 + br) * 20 + 10 + bc, 20, view);
        const start = toScreen(from, 20, view);
        expect(to - start).toBe(dr * 20 + dc);
      }
    }
  });

  it("Seat 2 on a phone: the start corners turn to the bottom-left", () => {
    expect(turnsFor(CLASSIC.starts[1]!, 20).turns).toBe(3);
    expect(turnsFor(CLASSIC.starts[2]!, 20).turns).toBe(2);
    expect(turnsFor(CLASSIC.starts[3]!, 20).turns).toBe(1);
    expect(turnsFor(CLASSIC.starts[4]!, 20).turns).toBe(0);
    const seat2 = CLASSIC.starts[2]!;
    expect(toScreen(seat2.row * 20 + seat2.col, 20, { turns: 2 })).toBe(19 * 20);
  });

  it("Duo: the start squares turn to the bottom-left quarter", () => {
    // (4,4) in the top-left quarter, (9,9) in the bottom-right one.
    expect(turnsFor(DUO.starts[1]!, DUO.size).turns).toBe(3);
    expect(turnsFor(DUO.starts[2]!, DUO.size).turns).toBe(1);
  });
});

describe("piece-controls › Zoom to own corners on a phone (zoom box)", () => {
  const at = (row: number, col: number) => row * 20 + col;

  it("Zoom on turn: corners in one quarter give a box of at least 10 around them, inside the board", () => {
    expect(zoomBox([at(15, 3), at(17, 5)], 20)).toEqual({ row: 10, col: 0, span: 10 });
    expect(zoomBox([at(0, 0)], 20)).toEqual({ row: 0, col: 0, span: 10 });
  });

  it("the box is in screen space: a turned view moves it", () => {
    expect(zoomBox([at(0, 0)], 20, { turns: 3 })).toEqual({ row: 10, col: 0, span: 10 });
  });

  it("the whole board with no corners or when the box would be 16 or more wide", () => {
    expect(zoomBox([], 20)).toBeUndefined();
    expect(zoomBox([at(2, 2), at(2, 15)], 20)).toBeUndefined();
    expect(zoomBox([at(2, 2), at(2, 12)], 20)).toEqual({ row: 0, col: 0, span: 15 });
  });

  it("a preview outside the box widens it", () => {
    const box = zoomBox([at(15, 3)], 20, undefined, [at(8, 3), at(9, 3)])!;
    expect(box.row).toBeLessThanOrEqual(8);
    expect(box.row + box.span).toBeGreaterThan(17);
  });
});
