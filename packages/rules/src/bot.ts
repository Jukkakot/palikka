import { cellAt, cellIndex, neighbours, type Board, type Cell } from "./board.js";
import { MAX_SEED, type Rng } from "./rng.js";

/** What one seat shows openly. */
export interface BotSeatView {
  readonly seat: number;
  readonly placed: number;
}

/** Everything a bot may know when choosing its turn. */
export interface BotView {
  readonly board: Board;
  readonly seat: number;
  readonly seats: readonly BotSeatView[];
  /** Daily puzzle only: the cells to claim. */
  readonly targets?: readonly number[];
}

/** A bot's way of choosing its cell. Swappable: a smarter one is a rules-only change. */
export type BotStrategy = (view: BotView, rng: Rng) => Cell;

/**
 * The placeholder bot: an unclaimed target if there is one, else an empty cell next to its own
 * (growing one area), else any empty cell; ties broken with `rng`. Throws on a full board.
 */
export const chooseBotCell: BotStrategy = ({ board, seat, targets }, rng) => {
  const empty = board.flatMap((owner, i) => (owner === 0 ? [i] : []));
  if (empty.length === 0) throw new Error("No empty cell");
  const open = targets?.filter((t) => board[t] === 0) ?? [];
  const nextToOwn = empty.filter((i) => neighbours(cellAt(i)).some((n) => board[cellIndex(n)] === seat));
  const pool = open.length > 0 ? open : nextToOwn.length > 0 ? nextToOwn : empty;
  return cellAt(pool[rng.int(0, pool.length - 1)]!);
};

/** A seed for one bot's rng, mixed from the game's seed and the bot's seat. */
export function botSeed(dealSeed: number, seat: number): number {
  let h = (dealSeed ^ Math.imul(seat, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % (MAX_SEED + 1);
}
