import { mirrorOrientation, ORIENTATIONS, turnOrientation, type Square } from "@palikka/rules";

/**
 * The board as the viewer sees it: turned in quarter turns so their start corner is at the
 * bottom-left (phone layout). Only the view turns; moves, previews and the rules stay in board space.
 * Board space → screen space turns a square (row, col) to (col, size − 1 − row) once per quarter turn.
 */
export interface ViewTransform {
  /** Quarter turns clockwise applied to the board for display. */
  turns: 0 | 1 | 2 | 3;
}

export const UNTURNED: ViewTransform = { turns: 0 };

type Turns = ViewTransform["turns"];

const quarter = (row: number, col: number, size: number): [number, number] => [col, size - 1 - row];

/** The screen index of a board square. */
export function toScreen(square: number, size: number, view: ViewTransform = UNTURNED): number {
  let row = Math.floor(square / size);
  let col = square % size;
  for (let i = 0; i < view.turns; i++) [row, col] = quarter(row, col, size);
  return row * size + col;
}

/** The board index of a screen square. */
export function toBoard(screenSquare: number, size: number, view: ViewTransform = UNTURNED): number {
  return toScreen(screenSquare, size, { turns: ((4 - view.turns) % 4) as Turns });
}

/** The orientation whose cells are the piece's `orientation` as it looks on screen (turned with the view). */
export function screenOrientation(piece: number, orientation: number, view: ViewTransform = UNTURNED): number {
  let o = orientation;
  for (let i = 0; i < view.turns; i++) o = turnOrientation(piece, o);
  return o;
}

/** The board orientation that looks like `shown` on screen: `screenOrientation` undone. */
export function boardOrientation(piece: number, shown: number, view: ViewTransform = UNTURNED): number {
  return screenOrientation(piece, shown, { turns: ((4 - view.turns) % 4) as Turns });
}

/**
 * A board orientation as it looks on screen: its screen orientation, and where the board
 * orientation's cell `ref` (its reference square) lies in it. A dragged piece is held by that cell.
 */
export function screenCell(piece: number, orientation: number, ref: readonly [number, number], view: ViewTransform = UNTURNED): { orientation: number; ref: [number, number] } {
  const shown = screenOrientation(piece, orientation, view);
  const { height, width } = ORIENTATIONS[piece]![orientation]!;
  let [r, c] = ref;
  let h = height;
  let w = width;
  // Within the piece's own box, each quarter turn clockwise takes (r, c) to (c, h − 1 − r).
  for (let i = 0; i < view.turns; i++) {
    [r, c] = [c, h - 1 - r];
    [h, w] = [w, h];
  }
  return { orientation: shown, ref: [r, c] };
}

/** "Käännä" as seen: a quarter turn clockwise on screen is one on the board too (rotations commute). */
export function turnOnScreen(piece: number, orientation: number): number {
  return turnOrientation(piece, orientation);
}

/**
 * "Peilaa" as seen: a left-to-right mirror on screen. With an odd number of turns that is a
 * top-to-bottom mirror on the board: mirrored left to right, then turned half a turn.
 */
export function mirrorOnScreen(piece: number, orientation: number, view: ViewTransform = UNTURNED): number {
  const mirrored = mirrorOrientation(piece, orientation);
  return view.turns % 2 === 0 ? mirrored : turnOrientation(piece, turnOrientation(piece, mirrored));
}

/** An arrow key's screen direction as a board direction. */
export function boardDirection(rows: number, cols: number, view: ViewTransform = UNTURNED): [rows: number, cols: number] {
  let r = rows;
  let c = cols;
  // Undo each clockwise quarter turn: a screen step (r, c) comes from the board step (−c, r).
  for (let i = 0; i < view.turns; i++) [r, c] = [-c, r];
  return [r + 0, c + 0];
}

/** The quarter turns that bring `start` into the bottom-left quarter of the board. */
export function turnsFor(start: Square, size: number): ViewTransform {
  for (const turns of [0, 1, 2, 3] as const) {
    const screen = toScreen(start.row * size + start.col, size, { turns });
    if (Math.floor(screen / size) >= size / 2 && screen % size < size / 2) return { turns };
  }
  return UNTURNED;
}

/** A square part of the board in screen space: its top-left screen square and its side. */
export interface ZoomBox {
  row: number;
  col: number;
  span: number;
}

export const ZOOM_MARGIN = 2;
export const ZOOM_MIN = 10;
/** A box this wide or wider shows the whole board instead (zooming would barely help). */
export const ZOOM_CUTOFF = 16;

/**
 * The zoom on the viewer's turn: the bounding box of their free corners on screen, plus a margin,
 * grown to a square of at least `ZOOM_MIN` and widened to hold `keep` (the preview or a dragged
 * piece), clamped to the board. Undefined (the whole board) with no corners or when the box would
 * be `ZOOM_CUTOFF` or more squares wide or the whole board.
 */
export function zoomBox(corners: Iterable<number>, size: number, view: ViewTransform = UNTURNED, keep: Iterable<number> = []): ZoomBox | undefined {
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  const include = (square: number, margin: number) => {
    const s = toScreen(square, size, view);
    const row = Math.floor(s / size);
    const col = s % size;
    top = Math.min(top, row - margin);
    left = Math.min(left, col - margin);
    bottom = Math.max(bottom, row + margin);
    right = Math.max(right, col + margin);
  };
  for (const square of corners) include(square, ZOOM_MARGIN);
  if (top === Infinity) return undefined;
  for (const square of keep) include(square, 0);
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, size - 1);
  right = Math.min(right, size - 1);
  const span = Math.max(bottom - top + 1, right - left + 1, ZOOM_MIN);
  if (span >= ZOOM_CUTOFF || span >= size) return undefined;
  // Centred on the box, then kept inside the board.
  const place = (from: number, to: number) => Math.min(Math.max(Math.floor((from + to + 1 - span) / 2), 0), size - span);
  return { row: place(top, bottom), col: place(left, right), span };
}
