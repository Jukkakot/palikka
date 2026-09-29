/**
 * The game-independent core: what a game must offer a bot, and what a bot offers back. States are
 * treated as immutable (`play` returns a new state), so search can keep and revisit them.
 */

/** A turn-based game as bots see it. `S` = state, `M` = move, `P` = player. */
export interface Game<S, M, P> {
  /** The player whose move it is. */
  toMove(state: S): P;
  isOver(state: S): boolean;
  /** Every legal move of the player to move, in a deterministic order; empty when none. */
  moves(state: S): readonly M[];
  /** The state after the player to move plays `move` (a legal move). */
  play(state: S, move: M): S;
}

/** Rates a state for `player`: higher is better. Called on the state right after its move. */
export type Evaluate<S, P> = (state: S, player: P) => number;

/**
 * How much work a bot may do: a time limit, a search depth, or both (whichever runs out first).
 * Plain data, so it crosses a Web Worker boundary as is.
 */
export interface Budget {
  /** Wall-clock milliseconds for this move. */
  readonly timeMs?: number;
  /** Plies to look ahead; a one-ply bot treats any depth ≥ 1 as its whole search. */
  readonly depth?: number;
}

/** A deterministic random source: uniform integer in [min, max], both included. */
export interface Rng {
  int(min: number, max: number): number;
}

/** A computer player. Returns undefined when the game is over or the player to move has no move. */
export interface Bot<S, M> {
  choose(state: S, budget: Budget, rng: Rng): M | undefined;
}

/** A millisecond clock; injectable so tests can control time. */
export type Clock = () => number;
