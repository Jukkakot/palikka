import { BOARD_SIZE, cellIndex, emptyBoard, type Board } from "./board.js";

/**
 * Test fixture: a board from up to BOARD_SIZE lines of digits, one per cell (0 = empty, 1–4 = seat);
 * missing lines and cells are empty. Spaces are ignored.
 *
 * ```ts
 * boardFromRows(["1100", "0022"])
 * ```
 */
export function boardFromRows(rows: readonly string[]): Board {
  const board = [...emptyBoard()];
  rows.forEach((line, row) => {
    [...line.replace(/\s+/g, "")].forEach((ch, col) => {
      if (row < BOARD_SIZE && col < BOARD_SIZE) board[cellIndex({ row, col })] = Number(ch);
    });
  });
  return board;
}

/** Readable text of a board for tests, logs and bug reports: one digit per cell, "." for empty. */
export function boardToText(board: Board): string {
  const lines: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    lines.push(
      board
        .slice(row * BOARD_SIZE, (row + 1) * BOARD_SIZE)
        .map((owner) => (owner === 0 ? "." : String(owner)))
        .join(""),
    );
  }
  return lines.join("\n");
}

export { randomGame, referenceMoves } from "./reference.js";
export { placement, positionWith } from "./engineFixtures.js";
