/** A square on the board. */
export interface Square {
  readonly row: number;
  readonly col: number;
}

/**
 * The board a game is played on: its size and each colour's start square. Variants add their own
 * configurations; the rules read only this.
 */
export interface BoardConfig {
  /** Squares per side; at most 32 (one 32-bit word per row). */
  readonly size: number;
  /** Start square per colour (1–4). */
  readonly starts: Readonly<Record<number, Square>>;
}

export const MAX_BOARD_SIZE = 32;

/** The classic 20×20 board: colour 1 top-left, 2 top-right, 3 bottom-right, 4 bottom-left. */
export const CLASSIC: BoardConfig = {
  size: 20,
  starts: {
    1: { row: 0, col: 0 },
    2: { row: 0, col: 19 },
    3: { row: 19, col: 19 },
    4: { row: 19, col: 0 },
  },
};
