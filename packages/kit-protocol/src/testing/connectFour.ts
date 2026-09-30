import { z } from "zod";
import type { GameRules, LogFields, PlayResult, Seat } from "../contract.js";

/*
 * A minimal Connect Four: the kit's own test game, proof that the contract fits a second game. The
 * seats (two by default, up to four so the kit's room tests can seat more) drop discs into a 7×6
 * board in turn; four in a row (across, down or diagonal) wins, a full board is a draw. Kept minimal
 * on purpose: the real Connect Four is a project of its own.
 */

export const COLUMNS = 7;
export const ROWS = 6;

/** A move: the column (0–6) to drop a disc into. */
export type ConnectFourMove = number;

/** The one option, so the kit's `setOptions` has something to change: the most seats (default 4). */
export interface ConnectFourOptions {
  seats?: 2 | 3 | 4;
}

export interface ConnectFourGame {
  readonly seed: number;
  /** Seats still in the game, ascending. */
  readonly seats: readonly number[];
  /** Seats whose player left. */
  readonly left: readonly number[];
  /** Row-major, row 0 at the top; 0 = empty, else the seat whose disc it is. */
  readonly cells: readonly number[];
  /** The seat on turn; 0 once the game is over. */
  readonly turn: number;
  readonly moves: number;
  readonly over: boolean;
  readonly winners: readonly number[];
}

export const connectFourMoveSchema = z.int().min(0).max(COLUMNS - 1);
export const connectFourOptionsSchema = z.strictObject({ seats: z.literal([2, 3, 4]).optional() });

const at = (row: number, col: number) => row * COLUMNS + col;

/** The lowest empty row of `col`, or -1 when the column is full. */
export function freeRow(cells: readonly number[], col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) if (cells[at(row, col)] === 0) return row;
  return -1;
}

/** True when the disc at (row, col) is part of four in a row. */
function wins(cells: readonly number[], row: number, col: number): boolean {
  const seat = cells[at(row, col)];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
    let count = 1;
    for (const sign of [1, -1]) {
      for (let r = row + sign * dr, c = col + sign * dc; r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && cells[at(r, c)] === seat; r += sign * dr, c += sign * dc) count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

/** The seat after `seat` among those still in the game. */
function nextSeat(seats: readonly number[], seat: number): number {
  return seats.find((s) => s > seat) ?? seats[0] ?? 0;
}

export const connectFourRules: GameRules<ConnectFourGame, ConnectFourMove, ConnectFourOptions> = {
  seatRange: (options) => ({ min: 2, max: options.seats ?? 4 }),

  start(seed: number, seats: readonly Seat[]): ConnectFourGame {
    const ordered = seats.map((s) => s.seat).sort((a, b) => a - b);
    const turn = ordered[0]!;
    return { seed, seats: ordered, left: [], cells: Array.from({ length: COLUMNS * ROWS }, () => 0), turn, moves: 0, over: false, winners: [] };
  },

  seatOnTurn: (game) => (game.over ? 0 : game.turn),

  turnFacts: (game): LogFields => ({ moves: game.moves }),

  play(game, seat, move): PlayResult<ConnectFourGame> {
    if (!game.seats.includes(seat)) return { ok: false, code: "NOT_SEATED" };
    if (game.over) return { ok: false, code: "WRONG_PHASE" };
    if (game.turn !== seat) return { ok: false, code: "NOT_YOUR_TURN" };
    if (!Number.isInteger(move) || move < 0 || move >= COLUMNS) return { ok: false, code: "INVALID_COMMAND" };
    const row = freeRow(game.cells, move);
    if (row < 0) return { ok: false, code: "COLUMN_FULL", facts: { seat, move: String(move) } };
    const cells = [...game.cells];
    cells[at(row, move)] = seat;
    const moves = game.moves + 1;
    if (wins(cells, row, move)) return { ok: true, game: { ...game, cells, moves, turn: 0, over: true, winners: [seat] } };
    if (cells.every((c) => c !== 0)) return { ok: true, game: { ...game, cells, moves, turn: 0, over: true, winners: [] } };
    return { ok: true, game: { ...game, cells, moves, turn: nextSeat(game.seats, seat) } };
  },

  removeSeat(game, seat) {
    if (game.over || !game.seats.includes(seat)) return game;
    const seats = game.seats.filter((s) => s !== seat);
    const left = [...game.left, seat];
    if (seats.length === 1) return { ...game, seats, left, turn: 0, over: true, winners: [seats[0]!] };
    const turn = game.turn === seat ? nextSeat(seats, seat) : game.turn;
    return { ...game, seats, left, turn };
  },

  isOver: (game) => game.over,

  winners: (game) => game.winners,

  end: (game) => (game.over ? game : { ...game, turn: 0, over: true, winners: [] }),

  fallbackMove(game) {
    if (game.over) return undefined;
    const col = Array.from({ length: COLUMNS }, (_, c) => c).find((c) => freeRow(game.cells, c) >= 0);
    return col;
  },

  finishFacts: (game): LogFields => ({ moves: game.moves }),

  moveText: (move) => `col${move}`,
};
