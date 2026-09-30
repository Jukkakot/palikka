import { checkBudget, deadline, systemClock } from "../budget.js";
import type { Bot, Clock, Evaluate, MultiplayerGame } from "../types.js";
import { ratePly, topByKey, type RatedMove } from "./common.js";

export interface BestReplyOptions {
  /** Clock for the time budget; defaults to the platform clock. */
  readonly now?: Clock;
  /** Root moves (best by the one-ply pass) searched deeper. */
  readonly rootWidth?: number;
  /** The root player's moves searched at inner layers, best by the move key. */
  readonly width?: number;
  /** Each opponent's replies searched at a reply layer, best by the move key. */
  readonly replyWidth?: number;
  /**
   * First depth searched after the one-ply pass (unless the budget's depth is lower). Depth 2 (one
   * pessimistic reply judged by the evaluation) measured weaker than greedy, so by default a time
   * limit goes from depth 1 straight to 3.
   */
  readonly firstDeepDepth?: number;
  /** Depth used when the budget has neither a depth nor a time limit. */
  readonly defaultDepth?: number;
  /** Told the deepest search finished for each answer (benchmarks). */
  readonly report?: (info: { readonly depth: number }) => void;
}

/** Deepest search ever started; the tree ends long before in any real game. */
const MAX_DEPTH = 64;

/**
 * Best-Reply Search (Schadd & Winands): the root player moves at even plies; at odd plies the one
 * reply of any opponent still in that hurts the root player most is searched, the other opponents
 * skip. Alpha-beta over that two-sided tree, iterative deepening, and beams by the game's cheap
 * move key keep it within a budget.
 *
 * Depth 1 is the greedy bot's one-ply pass (same order, same seeded tie-breaking), finished before
 * anything deeper, so under any time limit the answer is at least greedy's; then depth 3, 4, … (depth
 * 2 only when the budget's depth is 2). When the time runs out inside a depth, the previous depth's
 * answer stands, unless a root move searched completely at the cut depth already beats the move
 * that led the previous one.
 */
export function bestReplyBot<S, M, P>(
  game: MultiplayerGame<S, M, P>,
  evaluate: Evaluate<S, P>,
  options: BestReplyOptions = {},
): Bot<S, M> {
  const now = options.now ?? systemClock;
  const rootWidth = options.rootWidth ?? 10;
  const width = options.width ?? 6;
  const replyWidth = options.replyWidth ?? 3;
  const defaultDepth = options.defaultDepth ?? 2;
  const firstDeepDepth = options.firstDeepDepth ?? 3;

  return {
    choose(state, budget, rng) {
      checkBudget(budget);
      if (game.isOver(state)) return undefined;
      const moves = game.moves(state);
      if (moves.length === 0) return undefined;
      if (moves.length === 1) return moves[0];
      const expired = deadline(budget, now);
      const root = game.toMove(state);
      const maxDepth = Math.min(budget.depth ?? (budget.timeMs === undefined ? defaultDepth : MAX_DEPTH), MAX_DEPTH);

      const pass = ratePly(game, evaluate, state, moves, rng, expired);
      let answer = pass.rated[0]!.move;
      let finished = pass.complete ? 1 : 0;
      if (!pass.complete || maxDepth < 2) {
        options.report?.({ depth: finished });
        return answer;
      }

      let aborted = false;
      let cut = false;
      const leaf = (s: S): number => evaluate(s, root);

      const maxLayer = (s: S, depth: number, alpha: number, beta: number): number => {
        if (expired()) {
          aborted = true;
          return 0;
        }
        if (game.isOver(s)) return leaf(s);
        if (depth === 0) {
          cut = true;
          return leaf(s);
        }
        const own = game.movesOf(s, root);
        if (own.length === 0) return minLayer(s, depth - 1, alpha, beta);
        let value = -Infinity;
        for (const move of topByKey(own, (m) => game.moveKey(s, root, m), width)) {
          const v = minLayer(game.playAs(s, root, move), depth - 1, alpha, beta);
          if (aborted) return 0;
          if (v > value) value = v;
          if (value > alpha) alpha = value;
          if (alpha >= beta) break;
        }
        return value;
      };

      const minLayer = (s: S, depth: number, alpha: number, beta: number): number => {
        if (expired()) {
          aborted = true;
          return 0;
        }
        if (game.isOver(s)) return leaf(s);
        if (depth === 0) {
          cut = true;
          return leaf(s);
        }
        const replies: { player: P; move: M }[] = [];
        for (const player of game.opponents ? game.opponents(s, root) : game.players(s)) {
          if (player === root) continue;
          const own = game.movesOf(s, player);
          for (const move of topByKey(own, (m) => game.moveKey(s, player, m), replyWidth)) replies.push({ player, move });
        }
        if (replies.length === 0) return maxLayer(s, depth - 1, alpha, beta);
        let value = Infinity;
        for (const { player, move } of replies) {
          const v = maxLayer(game.playAs(s, player, move), depth - 1, alpha, beta);
          if (aborted) return 0;
          if (v < value) value = v;
          if (value < beta) beta = value;
          if (alpha >= beta) break;
        }
        return value;
      };

      let candidates: RatedMove<S, M>[] = pass.rated.slice(0, rootWidth);
      for (let depth = Math.min(firstDeepDepth, maxDepth); depth <= maxDepth; depth++) {
        cut = false;
        const values = new Map<RatedMove<S, M>, number>();
        let best: RatedMove<S, M> | undefined;
        let bestValue = -Infinity;
        for (const candidate of candidates) {
          const v = minLayer(candidate.child, depth - 1, bestValue, Infinity);
          if (aborted) break;
          values.set(candidate, v);
          if (best === undefined || v > bestValue) {
            best = candidate;
            bestValue = v;
          }
        }
        if (aborted) {
          // A move searched completely at this depth that beats the previous best (searched first) wins.
          if (best !== undefined && best !== candidates[0]) answer = best.move;
          break;
        }
        answer = best!.move;
        finished = depth;
        if (!cut) break; // the whole tree fits: deeper search cannot change anything
        candidates = [...candidates].sort((a, b) => values.get(b)! - values.get(a)!);
      }
      options.report?.({ depth: finished });
      return answer;
    },
  };
}
