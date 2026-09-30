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
 * How much work a bot may do: a time limit, a search depth, a number of iterations, or a mix
 * (whichever runs out first). A bot ignores a limit that does not apply to it. Plain data, so it
 * crosses a Web Worker boundary as is.
 */
export interface Budget {
  /** Wall-clock milliseconds for this move. */
  readonly timeMs?: number;
  /** Plies to look ahead; a one-ply bot treats any depth ≥ 1 as its whole search. */
  readonly depth?: number;
  /** Iterations of a sampling search (MCTS playouts); ignored by bots that do not sample. */
  readonly iterations?: number;
}

/** A deterministic random source: uniform integer in [min, max], both included. */
export interface Rng {
  int(min: number, max: number): number;
}

/**
 * A game with more than two players as search sees it: any player still in may be asked for its
 * moves or play one, even when not on turn (best-reply search lets the most dangerous opponent
 * answer), and moves have a cheap ordering key.
 */
export interface MultiplayerGame<S, M, P> extends Game<S, M, P> {
  /** The players still able to move, in turn order starting after the player to move. */
  players(state: S): readonly P[];
  /** `player`'s legal moves, on turn or not; empty when it is out or the game is over. */
  movesOf(state: S, player: P): readonly M[];
  /** The state after `player` plays `move` (a legal move of that player), on turn or not. */
  playAs(state: S, player: P, move: M): S;
  /**
   * The players among `players(state)` that play against `player` (optional; default all of them).
   * Best-reply search lets only these answer, so a partner is never searched as an opponent.
   */
  opponents?(state: S, player: P): readonly P[];
  /** How promising `move` looks for `player`, higher first. Must be cheap (no full evaluation). */
  moveKey(state: S, player: P, move: M): number;
}

/** A computer player. Returns undefined when the game is over or the player to move has no move. */
export interface Bot<S, M> {
  choose(state: S, budget: Budget, rng: Rng): M | undefined;
}

/** A millisecond clock; injectable so tests can control time. */
export type Clock = () => number;
