import type { BotTurn, BotView } from "./bot.js";
import { DEFAULT_WEIGHTS } from "./botLookahead.js";
import { DEFAULT_SAMPLING, samplingMove, samplingStrategy, type SamplingOptions } from "./botSampling.js";
import type { Square } from "./geometry.js";
import { createRng, MAX_SEED } from "./rng.js";

/** The hint is the bots' strategy, always minding the opponents (no random selfish turns). */
const HINT_OPTIONS: SamplingOptions = { ...DEFAULT_SAMPLING, weights: { ...DEFAULT_WEIGHTS, blockChance: 1 } };
const hintStrategy = samplingStrategy(HINT_OPTIONS);

/** A seed from everything the hint depends on, so the same position always gives the same hint. */
export function hintSeed(view: BotView): number {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h = Math.imul(h ^ n, 0x01000193) >>> 0;
  };
  for (const tile of view.board.squares) {
    mix(tile.id);
    mix(tile.rotation);
  }
  mix(view.board.spare.id);
  mix(view.board.spare.rotation);
  mix(view.seat);
  for (const s of view.seats) {
    mix(s.seat);
    mix(s.pawn.row * 7 + s.pawn.col);
    mix(s.cardsLeft);
  }
  for (const ch of `${view.lastInsertion ?? ""}|${view.target ?? ""}`) mix(ch.charCodeAt(0));
  return h % (MAX_SEED + 1);
}

/**
 * The whole turn the bots would take in the viewer's seat: the shift and the square to walk to.
 * `view` must hold only what the viewer may know (their own target, public found lists).
 */
export function hintTurn(view: BotView): BotTurn {
  return hintStrategy(view, createRng(hintSeed(view)));
}

/**
 * The square the bots would walk to after the shift just made: `view.board` is the shifted board
 * and `view.lastInsertion` that shift.
 */
export function hintMove(view: BotView): Square {
  return samplingMove(view, createRng(hintSeed(view)), HINT_OPTIONS);
}
