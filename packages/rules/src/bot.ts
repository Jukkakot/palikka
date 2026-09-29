import { legalMoves } from "./movegen.js";
import { decodeMove, type Placement } from "./moves.js";
import { PIECE_SIZES } from "./pieces.js";
import type { Position } from "./position.js";
import { createRng, MAX_SEED, type Rng } from "./rng.js";

/**
 * The simple bot: a random legal move among those that place the largest remaining piece that
 * still fits. Interim bot of the players' browsers until the bot library arrives, the server's
 * fallback, and the hint. Undefined when the colour has no legal move.
 */
export function simpleBotMove(position: Position, colour: number, rng: Rng): Placement | undefined {
  const { size } = position.config;
  const moves = legalMoves(position, colour);
  if (moves.length === 0) return undefined;
  const placements = moves.map((code) => decodeMove(code, size));
  const largest = Math.max(...placements.map((p) => PIECE_SIZES[p.piece]!));
  const best = placements.filter((p) => PIECE_SIZES[p.piece] === largest);
  return best[rng.int(0, best.length - 1)];
}

/** A seed for one bot decision, mixed from the game's seed, the move number and the colour. */
export function botSeed(gameSeed: number, moveNumber: number, colour: number): number {
  let h = (gameSeed ^ Math.imul(moveNumber + 1, 0x2545f491) ^ Math.imul(colour, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % (MAX_SEED + 1);
}

/** The rng of `colour`'s decision in `position`: the same on every replay, so nothing needs saving. */
export function botRng(gameSeed: number, position: Position, colour: number): Rng {
  return createRng(botSeed(gameSeed, position.moveNumber, colour));
}
