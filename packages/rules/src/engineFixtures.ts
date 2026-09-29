import type { BoardConfig } from "./config.js";
import { CLASSIC } from "./config.js";
import type { Placement } from "./moves.js";
import { normaliseShape, ORIENTATIONS, pieceNumber, shapeKey, type ShapeCell } from "./pieces.js";
import { newPosition, type Position } from "./position.js";

/** Test fixture: the placement of piece `id` in the orientation drawn by `lines` ("#" = square). */
export function placement(id: string, lines: readonly string[], row: number, col: number): Placement {
  const piece = pieceNumber(id);
  const cells: ShapeCell[] = [];
  lines.forEach((line, r) => [...line].forEach((ch, c) => ch === "#" && cells.push([r, c])));
  const key = shapeKey(normaliseShape(cells));
  const orientation = ORIENTATIONS[piece]!.findIndex((o) => shapeKey(o.cells) === key);
  if (orientation < 0) throw new Error(`${id} has no orientation ${lines.join("/")}`);
  return { piece, orientation, row, col };
}

/**
 * Test fixture: a position with pieces put down directly (no rule checks, turn unchanged), so tests
 * can set up any board.
 */
export function positionWith(
  pieces: readonly [colour: number, placement: Placement][],
  colours: readonly number[] = [1, 2, 3, 4],
  config: BoardConfig = CLASSIC,
): Position {
  const start = newPosition(config, colours, colours[0]!);
  const cells = [...start.cells];
  const placed: Record<number, number[]> = {};
  for (const colour of start.colours) placed[colour] = [];
  for (const [colour, p] of pieces) {
    for (const [r, c] of ORIENTATIONS[p.piece]![p.orientation]!.cells) cells[(p.row + r) * config.size + p.col + c] = colour;
    placed[colour]!.push(p.piece);
  }
  return { ...start, cells, placed, moveNumber: pieces.length };
}
