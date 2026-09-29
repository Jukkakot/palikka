import { MAX_ORIENTATIONS, PIECE_IDS } from "./pieces.js";

/**
 * A move in readable form (JSON, protocol): a piece in one of its orientations, placed with the
 * top-left of the orientation's bounding box at (row, col).
 */
export interface Placement {
  readonly piece: number;
  readonly orientation: number;
  readonly row: number;
  readonly col: number;
}

/** A move as a compact integer code; valid for one board size. */
export type Move = number;

export function encodeMove({ piece, orientation, row, col }: Placement, size: number): Move {
  return ((piece * MAX_ORIENTATIONS + orientation) * size + row) * size + col;
}

export function decodeMove(code: Move, size: number): Placement {
  const col = code % size;
  let rest = (code - col) / size;
  const row = rest % size;
  rest = (rest - row) / size;
  return { piece: Math.floor(rest / MAX_ORIENTATIONS), orientation: rest % MAX_ORIENTATIONS, row, col };
}

/** Short text for logs and tests, e.g. "F5/3@4,7". */
export function placementText({ piece, orientation, row, col }: Placement): string {
  return `${PIECE_IDS[piece] ?? `?${piece}`}/${orientation}@${row},${col}`;
}
