/**
 * The board of the placeholder game: a square grid of cells, each empty (0) or owned by a seat 1–4.
 * Stored as a flat, row-major array so it is plain JSON and syncs as a list of numbers.
 */

/** Cells per side; the real game uses the same 20×20 board. */
export const BOARD_SIZE = 20;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export interface Cell {
  readonly row: number;
  readonly col: number;
}

/** Owner seat of every cell, row-major; 0 = empty. */
export type Board = readonly number[];

export function emptyBoard(): Board {
  return Array.from({ length: CELL_COUNT }, () => 0);
}

export function isOnBoard({ row, col }: Cell): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE;
}

export function cellIndex({ row, col }: Cell): number {
  return row * BOARD_SIZE + col;
}

export function cellAt(index: number): Cell {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

/** The four orthogonal neighbours that are on the board. */
export function neighbours({ row, col }: Cell): Cell[] {
  return [
    { row: row - 1, col },
    { row, col: col + 1 },
    { row: row + 1, col },
    { row, col: col - 1 },
  ].filter(isOnBoard);
}

/** How many cells `seat` owns. */
export function cellsOf(board: Board, seat: number): number {
  return board.reduce((n, owner) => (owner === seat ? n + 1 : n), 0);
}

/** A board of the right size with owners 0–4 only; throws otherwise (checks saved and synced boards). */
export function checkBoard(board: readonly unknown[]): Board {
  if (board.length !== CELL_COUNT) throw new Error(`Board needs ${CELL_COUNT} cells, got ${board.length}`);
  for (const owner of board) {
    if (!Number.isInteger(owner) || (owner as number) < 0 || (owner as number) > 4) throw new Error(`Bad cell owner ${String(owner)}`);
  }
  return board as Board;
}
