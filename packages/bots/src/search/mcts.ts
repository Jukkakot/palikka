import { checkBudget, deadline, systemClock } from "../budget.js";
import type { Bot, Clock, Evaluate, MultiplayerGame, Rng } from "../types.js";
import { ratePly, topByKey } from "./common.js";

export interface MctsOptions {
  /** Clock for the time budget; defaults to the platform clock. */
  readonly now?: Clock;
  /** Exploration constant of UCT (rewards are in [0, 1]). */
  readonly exploration?: number;
  /** Progressive widening: a node may have ⌈k · visits^alpha⌉ children. */
  readonly widenK?: number;
  readonly widenAlpha?: number;
  /** Moves played from a new node before its position is rated. */
  readonly playoutPlies?: number;
  /** Rating difference (in evaluation units) that moves a reward from ½ to about ¾. */
  readonly scale?: number;
  /** Iterations used when the budget has neither iterations nor a time limit. */
  readonly defaultIterations?: number;
  /** Told the iterations run for each answer (benchmarks). */
  readonly report?: (info: { readonly iterations: number }) => void;
}

interface Node<S, M, P> {
  readonly state: S;
  readonly move: M | undefined;
  /** Player who picks among this node's children. */
  readonly mover: P;
  /** Untried and tried moves in widening order (children take them from the front). */
  readonly order: readonly M[];
  readonly children: Node<S, M, P>[];
  visits: number;
  /** Reward sums per player index (see `players`). */
  readonly sums: number[];
  readonly terminal: boolean;
}

/** Playout picks among the best three moves by key, weighted 3 : 2 : 1. */
function playoutPick<M>(rng: Rng, best: readonly M[]): M {
  const weights = [3, 2, 1].slice(0, best.length);
  let r = rng.int(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < best.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return best[i]!;
  }
  return best[0]!;
}

/**
 * Multi-player Monte Carlo tree search (max^n UCT): every node keeps a reward per player and the
 * player to move picks by its own reward, so every colour plays for itself. Children are opened
 * in the game's cheap move-key order (progressive widening; the root in the one-ply pass order),
 * playouts are short and follow the key, and their end position is rated for every player by the
 * evaluation, turned into [0, 1] against the players' mean with a logistic curve.
 *
 * Like best-reply search it first finishes the greedy one-ply pass, so under a tiny time limit it
 * answers as greedy does. The answer is the most visited root move.
 */
export function mctsBot<S, M, P>(game: MultiplayerGame<S, M, P>, evaluate: Evaluate<S, P>, options: MctsOptions = {}): Bot<S, M> {
  const now = options.now ?? systemClock;
  const exploration = options.exploration ?? 0.5;
  const widenK = options.widenK ?? 2;
  const widenAlpha = options.widenAlpha ?? 0.5;
  const playoutPlies = options.playoutPlies ?? 4;
  const scale = options.scale ?? 10;
  const defaultIterations = options.defaultIterations ?? 400;

  return {
    choose(state, budget, rng) {
      checkBudget(budget);
      if (game.isOver(state)) return undefined;
      const moves = game.moves(state);
      if (moves.length === 0) return undefined;
      if (moves.length === 1) return moves[0];
      const expired = deadline(budget, now);
      const iterations = budget.iterations ?? (budget.timeMs === undefined ? defaultIterations : Infinity);

      const pass = ratePly(game, evaluate, state, moves, rng, expired);
      if (!pass.complete) {
        options.report?.({ iterations: 0 });
        return pass.rated[0]!.move;
      }

      const rootPlayer = game.toMove(state);
      const players = [rootPlayer, ...game.players(state).filter((p) => p !== rootPlayer)];
      const index = new Map(players.map((p, i) => [p, i]));

      const makeNode = (s: S, move: M | undefined, order?: readonly M[]): Node<S, M, P> => {
        const terminal = game.isOver(s);
        const mover = game.toMove(s);
        const own = terminal ? [] : (order ?? topByKey(game.moves(s), (m) => game.moveKey(s, mover, m), Infinity));
        return { state: s, move, mover, order: own, children: [], visits: 0, sums: players.map(() => 0), terminal: terminal || own.length === 0 };
      };

      const rewards = (s: S): number[] => {
        const values = players.map((p) => evaluate(s, p));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.map((v) => 1 / (1 + Math.exp(-(v - mean) / scale)));
      };

      const playout = (s: S): S => {
        let current = s;
        for (let ply = 0; ply < playoutPlies && !game.isOver(current); ply++) {
          const mover = game.toMove(current);
          const own = game.moves(current);
          if (own.length === 0) break;
          current = game.play(current, playoutPick(rng, topByKey(own, (m) => game.moveKey(current, mover, m), 3)));
        }
        return current;
      };

      const rootNode = makeNode(state, undefined, pass.rated.map((r) => r.move));
      const childOf = new Map(pass.rated.map((r) => [r.move, r.child]));

      const select = (node: Node<S, M, P>): Node<S, M, P> => {
        const mover = index.get(node.mover) ?? 0;
        const logN = Math.log(node.visits);
        let best = node.children[0]!;
        let bestScore = -Infinity;
        for (const child of node.children) {
          const score = child.sums[mover]! / child.visits + exploration * Math.sqrt(logN / child.visits);
          if (score > bestScore) {
            best = child;
            bestScore = score;
          }
        }
        return best;
      };

      let done = 0;
      for (; done < iterations && !expired(); done++) {
        const path = [rootNode];
        let node = rootNode;
        let reward: number[] | undefined;
        for (;;) {
          if (node.terminal) {
            reward = rewards(node.state);
            break;
          }
          const allowed = Math.min(node.order.length, Math.ceil(widenK * Math.max(1, node.visits) ** widenAlpha));
          if (node.children.length < allowed) {
            const move = node.order[node.children.length]!;
            const childState = node === rootNode ? childOf.get(move)! : game.play(node.state, move);
            const child = makeNode(childState, move);
            node.children.push(child);
            path.push(child);
            reward = rewards(child.terminal ? child.state : playout(child.state));
            break;
          }
          node = select(node);
          path.push(node);
        }
        for (const visited of path) {
          visited.visits++;
          for (let p = 0; p < players.length; p++) visited.sums[p]! += reward[p]!;
        }
      }

      options.report?.({ iterations: done });
      if (rootNode.children.length === 0) return pass.rated[0]!.move;
      let best = rootNode.children[0]!;
      for (const child of rootNode.children) {
        if (child.visits > best.visits || (child.visits === best.visits && child.sums[0]! / child.visits > best.sums[0]! / best.visits)) {
          best = child;
        }
      }
      return best.move;
    },
  };
}
