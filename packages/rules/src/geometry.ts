/** The board is BOARD_SIZE × BOARD_SIZE squares. */
export const BOARD_SIZE = 7;

/** N = toward row 0, E = toward the last column, S = toward the last row, W = toward column 0. */
export type Direction = "N" | "E" | "S" | "W";

/** All directions in clockwise order. */
export const DIRECTIONS: readonly Direction[] = ["N", "E", "S", "W"];

/** A square `(row, col)`; `(0, 0)` is the top-left square. */
export interface Square {
  readonly row: number;
  readonly col: number;
}

const DELTA: Record<Direction, readonly [number, number]> = {
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
};

export function isOnBoard(row: number, col: number): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** The square at `(row, col)`; throws RangeError for coordinates outside the board. */
export function square(row: number, col: number): Square {
  if (!isOnBoard(row, col)) throw new RangeError(`Invalid square (${row}, ${col})`);
  return { row, col };
}

/** Row-major index 0…48. */
export function squareIndex(sq: Square): number {
  return sq.row * BOARD_SIZE + sq.col;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

/** All 49 squares in row-major order. */
export const ALL_SQUARES: readonly Square[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) =>
  square(Math.floor(i / BOARD_SIZE), i % BOARD_SIZE),
);

/** The neighbouring square toward `dir`, or undefined beyond the board edge. */
export function neighbour(sq: Square, dir: Direction): Square | undefined {
  const [dr, dc] = DELTA[dir];
  const row = sq.row + dr;
  const col = sq.col + dc;
  return isOnBoard(row, col) ? { row, col } : undefined;
}

export function opposite(dir: Direction): Direction {
  return rotateDirection(dir, 2);
}

/** Turns `dir` clockwise by `steps` quarter turns (negative = counter-clockwise). */
export function rotateDirection(dir: Direction, steps: number): Direction {
  const i = DIRECTIONS.indexOf(dir);
  return DIRECTIONS[(((i + steps) % 4) + 4) % 4]!;
}

/** The direction from `a` to its orthogonal neighbour `b`, or undefined if they are not neighbours. */
export function directionTo(a: Square, b: Square): Direction | undefined {
  return DIRECTIONS.find((dir) => {
    const n = neighbour(a, dir);
    return n !== undefined && sameSquare(n, b);
  });
}
