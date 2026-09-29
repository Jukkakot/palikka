import { shuffled } from "../players.js";
import type { Evaluate, Game, Rng } from "../types.js";

/** A move of the root player with the state after it and its one-ply rating. */
export interface RatedMove<S, M> {
  readonly move: M;
  readonly child: S;
  readonly value: number;
}

/**
 * The one-ply pass every search starts with, exactly as the greedy bot rates: every legal move in
 * a seeded random order, stopping at the deadline (at least one move is always rated). Returns the
 * rated moves best first (ties keep the seeded order, so the first equals greedy's choice) and
 * whether every move was rated.
 */
export function ratePly<S, M, P>(
  game: Game<S, M, P>,
  evaluate: Evaluate<S, P>,
  state: S,
  moves: readonly M[],
  rng: Rng,
  expired: () => boolean,
): { rated: RatedMove<S, M>[]; complete: boolean } {
  const player = game.toMove(state);
  const rated: RatedMove<S, M>[] = [];
  let complete = true;
  for (const move of shuffled(rng, moves)) {
    if (rated.length > 0 && expired()) {
      complete = false;
      break;
    }
    const child = game.play(state, move);
    rated.push({ move, child, value: evaluate(child, player) });
  }
  rated.sort((a, b) => b.value - a.value);
  return { rated, complete };
}

/** The `count` moves with the highest key, highest first; equal keys keep the moves' order. */
export function topByKey<M>(moves: readonly M[], key: (move: M) => number, count: number): M[] {
  if (moves.length <= 1) return [...moves];
  const keyed = moves.map((move, index) => ({ move, index, key: key(move) }));
  keyed.sort((a, b) => b.key - a.key || a.index - b.index);
  return keyed.slice(0, count).map((k) => k.move);
}
