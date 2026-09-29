import { CELL_COUNT } from "./board.js";
import type { GameState } from "./game.js";
import { createRng, shuffle } from "./rng.js";

/**
 * The daily puzzle (placeholder): a solo game whose target cells come only from the calendar date,
 * so everyone on the same day plays the same puzzle. The goal is to claim every target in as few
 * turns as possible; its par is one turn per target. The real puzzle (fill a shape with pieces)
 * replaces it later, keeping this shape: seed from the date, a solo `GameState`, a par.
 */

/** The seat the puzzle player sits in. */
export const DAILY_SEAT = 1;

/** Target cells per puzzle. */
export const DAILY_TARGETS = 6;

export interface DailyPuzzle {
  game: GameState;
  /** The fewest turns that solve it. */
  par: number;
}

/** The seed of a date `YYYY-MM-DD`: FNV-1a over the string, so it is stable everywhere. */
export function dailySeed(date: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The puzzle of `date`: an empty board, one seat on turn, and DAILY_TARGETS target cells drawn from the date. */
export function startDailyPuzzle(date: string, name: string): DailyPuzzle {
  const seed = dailySeed(date);
  const all = Array.from({ length: CELL_COUNT }, (_, i) => i);
  const targets = shuffle(createRng(seed), all)
    .slice(0, DAILY_TARGETS)
    .sort((a, b) => a - b);
  const game: GameState = {
    seed,
    board: all.map(() => 0),
    seats: [{ seat: DAILY_SEAT, name, bot: false, placed: 0 }],
    step: "play",
    turnSeat: DAILY_SEAT,
    turn: 1,
    winnerSeat: 0,
    targets,
  };
  return { game, par: targets.length };
}
