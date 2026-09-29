import type { Board } from "./board.js";
import { samplingMove, samplingStrategy } from "./botSampling.js";
import { ALL_SQUARES, type Square } from "./geometry.js";
import { reachableSquares } from "./move.js";
import { MAX_SEED, type Rng } from "./rng.js";
import { INSERTIONS, reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { ROTATIONS, type Rotation } from "./tile.js";
import { targetTileId } from "./treasures.js";
import type { TreasureId } from "./tileSet.js";

/** What one seat shows openly: its pawn and how far it has got. Never its target or stack. */
export interface BotSeatView {
  readonly seat: number;
  readonly pawn: Square;
  readonly found: number;
  readonly cardsLeft: number;
  /** The treasures it has found (public). Optional: without them found treasures still count as possible targets. */
  readonly foundTreasures?: readonly TreasureId[];
}

/**
 * Everything a bot may fairly know when choosing its turn: the board, every seat's open state,
 * the last insertion, and only its own target. Other players' targets and stacks are never in it.
 */
export interface BotView {
  readonly board: Board;
  readonly seat: number;
  readonly seats: readonly BotSeatView[];
  /** The insertion of the previous shift; its reverse is not allowed. */
  readonly lastInsertion: InsertionId | undefined;
  /** The bot's current target; undefined once every card is found (heading home). */
  readonly target: TreasureId | undefined;
}

/** A whole turn: the shift, then the square the pawn moves to (its own square to stay). */
export interface BotTurn {
  readonly insertion: InsertionId;
  readonly rotation: Rotation;
  readonly to: Square;
}

/** A bot's way of choosing its turn. Swappable: a smarter one is a rules-only change. */
export type BotStrategy = (view: BotView, rng: Rng) => BotTurn;

/** Every shift allowed after `last`: all insertions but its reverse, with every rotation. */
export function allowedShifts(last: InsertionId | undefined): { insertion: InsertionId; rotation: Rotation }[] {
  const forbidden = last === undefined ? undefined : reverseOf(last);
  return INSERTIONS.filter((id) => id !== forbidden).flatMap((insertion) => ROTATIONS.map((rotation) => ({ insertion, rotation })));
}

const distance = (a: Square, b: Square) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * The first, greedy strategy, kept as the tournament baseline: reach the target this turn if any
 * allowed shift lets it, otherwise end as close to it as possible (rows plus columns). A target
 * pushed onto the spare is out of reach for that shift. Ties are broken with `rng`.
 */
export const greedyBotTurn: BotStrategy = (view, rng) => {
  const own = view.seats.find((s) => s.seat === view.seat);
  if (!own) throw new Error(`Seat ${view.seat} is not in the view`);
  const tileId = targetTileId(view.seat, view.target);

  let best: BotTurn[] = [];
  let bestScore = Infinity;
  for (const { insertion, rotation } of allowedShifts(view.lastInsertion)) {
    const shifted = shiftBoard(view.board, insertion, rotation, [own.pawn]);
    const pawn = shifted.pawns[0]!;
    const reachable = reachableSquares(shifted.board, pawn);
    const at = shifted.board.squares.findIndex((tile) => tile.id === tileId);
    const target = at === -1 ? undefined : ALL_SQUARES[at]!;
    for (const to of reachable) {
      // Out of reach (on the spare): every square scores the same, worse than any on-board one.
      const score = target === undefined ? 100 : distance(to, target);
      if (score < bestScore) {
        bestScore = score;
        best = [];
      }
      if (score === bestScore) best.push({ insertion, rotation, to });
    }
  }
  return best[rng.int(0, best.length - 1)]!;
};

/** The bots' strategy: the sampling search over the look-ahead's best choices (see `botSampling.ts`). */
export const chooseBotTurn: BotStrategy = samplingStrategy();

/**
 * Where a bot walks when it takes over a turn whose shift is already made (autoplay turned on
 * after the player's own shift): `view.board` is the shifted board, `view.lastInsertion` that shift.
 */
export function botMoveAfterShift(view: BotView, rng: Rng): Square {
  return samplingMove(view, rng);
}

/** A seed for one bot's rng, mixed from the game's deal seed and the bot's seat. */
export function botSeed(dealSeed: number, seat: number): number {
  let h = (dealSeed ^ Math.imul(seat, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % (MAX_SEED + 1);
}
