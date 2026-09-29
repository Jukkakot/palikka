import { checkBudget, deadline, systemClock } from "./budget.js";
import type { Bot, Clock, Evaluate, Game, Rng } from "./types.js";

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface GreedyOptions {
  /** Clock for the time budget; defaults to the platform clock. */
  readonly now?: Clock;
}

/**
 * One-ply greedy player: plays each legal move, rates the resulting state for the mover with
 * `evaluate`, and returns the best. Moves are rated in a seeded random order and the first of the
 * best wins, so ties are broken by the seed and a time cut-off rates a random subset. At least
 * one move is always rated, however small the time budget.
 */
export function greedyBot<S, M, P>(game: Game<S, M, P>, evaluate: Evaluate<S, P>, options: GreedyOptions = {}): Bot<S, M> {
  const now = options.now ?? systemClock;
  return {
    choose(state, budget, rng) {
      checkBudget(budget);
      if (game.isOver(state)) return undefined;
      const moves = game.moves(state);
      if (moves.length === 0) return undefined;
      if (moves.length === 1) return moves[0];
      const expired = deadline(budget, now);
      const player = game.toMove(state);
      let best: M | undefined;
      let bestValue = -Infinity;
      for (const move of shuffled(rng, moves)) {
        if (best !== undefined && expired()) break;
        const value = evaluate(game.play(state, move), player);
        if (best === undefined || value > bestValue) {
          best = move;
          bestValue = value;
        }
      }
      return best;
    },
  };
}

/** Plays a uniformly random legal move: the baseline for tests and tournaments. */
export function randomBot<S, M, P>(game: Game<S, M, P>): Bot<S, M> {
  return {
    choose(state, budget, rng) {
      checkBudget(budget);
      if (game.isOver(state)) return undefined;
      const moves = game.moves(state);
      return moves.length === 0 ? undefined : moves[rng.int(0, moves.length - 1)];
    },
  };
}
