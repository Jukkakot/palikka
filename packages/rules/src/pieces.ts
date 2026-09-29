/**
 * The 21 pieces every colour owns and their distinct orientations. Orientations are generated at
 * module load from one base shape per piece, so their indexes are stable (pinned by a golden test).
 */

/** Piece ids in id order: the index in this list is the piece number used everywhere else. */
export const PIECE_IDS = [
  "I1", "I2", "I3", "V3", "I4", "O4", "T4", "L4", "Z4",
  "F5", "I5", "L5", "N5", "P5", "T5", "U5", "V5", "W5", "X5", "Y5", "Z5",
] as const;

export type PieceName = (typeof PIECE_IDS)[number];

export const PIECE_COUNT = PIECE_IDS.length;

/** The single square: placing it last earns the extra bonus. */
export const MONOMINO = 0;

/** Most orientations a piece can have (4 rotations × mirror); also the stride in move codes. */
export const MAX_ORIENTATIONS = 8;

/** Base shapes, one row per string, "#" = square. */
const BASE_SHAPES: readonly (readonly string[])[] = [
  ["#"],
  ["##"],
  ["###"],
  ["#.", "##"],
  ["####"],
  ["##", "##"],
  ["###", ".#."],
  ["###", "#.."],
  ["##.", ".##"],
  [".##", "##.", ".#."],
  ["#####"],
  ["####", "#..."],
  ["##..", ".###"],
  ["##", "##", "#."],
  ["###", ".#.", ".#."],
  ["#.#", "###"],
  ["#..", "#..", "###"],
  ["#..", "##.", ".##"],
  [".#.", "###", ".#."],
  ["####", ".#.."],
  ["##.", ".#.", ".##"],
];

/** A square of a shape, relative to the shape's bounding box top-left. */
export type ShapeCell = readonly [row: number, col: number];

export interface Orientation {
  readonly piece: number;
  readonly index: number;
  /** Squares sorted row-major, normalised to the bounding box's top-left. */
  readonly cells: readonly ShapeCell[];
  readonly height: number;
  readonly width: number;
  /** One mask per row of the bounding box; bit c = column c. */
  readonly rows: readonly number[];
}

function parseShape(lines: readonly string[]): ShapeCell[] {
  const cells: ShapeCell[] = [];
  lines.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === "#") cells.push([row, col]);
    });
  });
  return cells;
}

/** Shifts to the top-left and sorts row-major. */
export function normaliseShape(cells: readonly ShapeCell[]): ShapeCell[] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]): ShapeCell => [r - minRow, c - minCol])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function shapeKey(cells: readonly ShapeCell[]): string {
  return cells.map(([r, c]) => `${r},${c}`).join(";");
}

/** Quarter turn clockwise (before normalising). */
export function rotateShape(cells: readonly ShapeCell[]): ShapeCell[] {
  return normaliseShape(cells.map(([r, c]): ShapeCell => [c, -r]));
}

/** Mirror left–right (before normalising). */
export function mirrorShape(cells: readonly ShapeCell[]): ShapeCell[] {
  return normaliseShape(cells.map(([r, c]): ShapeCell => [r, -c]));
}

/** The distinct shapes of all 8 transforms, sorted by their key so indexes are stable. */
export function distinctOrientations(cells: readonly ShapeCell[]): ShapeCell[][] {
  const found = new Map<string, ShapeCell[]>();
  let shape = normaliseShape(cells);
  for (let turn = 0; turn < 4; turn++) {
    for (const s of [shape, mirrorShape(shape)]) found.set(shapeKey(s), s);
    shape = rotateShape(shape);
  }
  return [...found.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, s]) => s);
}

function toOrientation(piece: number, index: number, cells: ShapeCell[]): Orientation {
  const height = Math.max(...cells.map(([r]) => r)) + 1;
  const width = Math.max(...cells.map(([, c]) => c)) + 1;
  const rows = new Array<number>(height).fill(0);
  for (const [r, c] of cells) rows[r]! |= 1 << c;
  return { piece, index, cells, height, width, rows };
}

/** ORIENTATIONS[piece][index]. */
export const ORIENTATIONS: readonly (readonly Orientation[])[] = BASE_SHAPES.map((lines, piece) =>
  distinctOrientations(parseShape(lines)).map((cells, index) => toOrientation(piece, index, cells)),
);

/** Squares per piece, by piece number. */
export const PIECE_SIZES: readonly number[] = ORIENTATIONS.map((o) => o[0]!.cells.length);

/** Squares of a full piece set (89). */
export const SET_SQUARES = PIECE_SIZES.reduce((a, b) => a + b, 0);

/** For each piece and orientation index, the index of the given transform of that orientation. */
function transformTable(transform: (cells: readonly ShapeCell[]) => ShapeCell[]): readonly (readonly number[])[] {
  return ORIENTATIONS.map((list) => {
    const index = new Map(list.map((o) => [shapeKey(o.cells), o.index]));
    return list.map((o) => index.get(shapeKey(transform(o.cells)))!);
  });
}

const TURN_CW = transformTable(rotateShape);
const MIRROR = transformTable(mirrorShape);

/** The orientation of `piece` a quarter turn clockwise from orientation `index`. */
export function turnOrientation(piece: number, index: number): number {
  return TURN_CW[piece]![index]!;
}

/** The orientation of `piece` mirrored left to right from orientation `index`. */
export function mirrorOrientation(piece: number, index: number): number {
  return MIRROR[piece]![index]!;
}

export function pieceNumber(name: string): number {
  const index = (PIECE_IDS as readonly string[]).indexOf(name);
  if (index < 0) throw new RangeError(`Unknown piece ${name}`);
  return index;
}
