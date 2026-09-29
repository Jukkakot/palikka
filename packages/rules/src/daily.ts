import { fewestTurns } from "./dailySolver.js";
import { applyMove, type GameCommandResult, type GameState } from "./game.js";
import type { Square } from "./geometry.js";
import { createRng, shuffle } from "./rng.js";
import { setupBoard } from "./setup.js";
import { TREASURES, type TreasureId } from "./tileSet.js";
import { homeSquare } from "./treasures.js";

/**
 * The daily puzzle: a solo game whose board, spare and destination come only from the calendar
 * date, so everyone on the same day plays the same puzzle. The goal is one treasure in as few
 * turns as possible; the puzzle knows the best possible (its par).
 */

/** The seat the puzzle player sits in (its home corner). */
export const DAILY_SEAT = 1;

/** The par the destination is chosen for; from the start corner every treasure takes at most 2. */
export const DAILY_PAR = 2;

export interface DailyPuzzle {
  game: GameState;
  /** The fewest turns that reach the destination. */
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

/**
 * The puzzle of `date`: the board of its seed, one seat on turn at home, and as the only card the
 * first treasure of a seeded shuffle whose best is `DAILY_PAR` turns (else the hardest one found).
 */
export function startDailyPuzzle(date: string, name: string): DailyPuzzle {
  const seed = dailySeed(date);
  const board = setupBoard(seed);
  const home = homeSquare(DAILY_SEAT);
  const best = fewestTurns(board, home, DAILY_PAR);
  const order = shuffle(createRng(seed), TREASURES).filter((t) => best.has(t));
  const hardest = Math.max(...order.map((t) => best.get(t)!));
  const target: TreasureId = order.find((t) => best.get(t) === hardest)!;
  const game: GameState = {
    seed,
    board,
    seats: [{ seat: DAILY_SEAT, name, bot: false, pawn: home, stack: [target], found: [] }],
    step: "shift",
    turnSeat: DAILY_SEAT,
    turn: 1,
    lastInsertion: undefined,
    winnerSeat: 0,
  };
  return { game, par: hardest };
}

/** A move in the puzzle: the normal move, and finding the destination solves it in this turn. */
export function applyPuzzleMove(state: GameState, seat: number, to: Square): GameCommandResult {
  const result = applyMove(state, seat, to);
  if (!result.ok) return result;
  const mover = result.state.seats.find((s) => s.seat === seat)!;
  if (mover.found.length < mover.stack.length || result.state.step === "finished") return result;
  return { ok: true, state: { ...result.state, step: "finished", winnerSeat: seat, turn: state.turn, turnSeat: seat } };
}
