import type { Evaluate, MultiplayerGame, Rng } from "../../types.js";

/**
 * Toy multi-player game for the search tests. Items lie on a table; a player on turn takes one and
 * scores its value. Some items can only be taken once another one is gone (taking A uncovers B), so
 * the move that scores most right away can hand an opponent a bigger item. Players listed in `out`
 * never move. The game ends when no item can be taken.
 */
export interface Item {
  readonly value: number;
  /** Index of the item that must be taken first. */
  readonly under?: number;
}

export interface Grab {
  readonly items: readonly Item[];
  readonly taken: readonly boolean[];
  readonly scores: readonly number[];
  readonly turn: number;
  readonly out: readonly number[];
}

export function newGrab(items: readonly Item[], players: number, out: readonly number[] = []): Grab {
  const first = [...Array(players).keys()].find((p) => !out.includes(p)) ?? 0;
  return { items, taken: items.map(() => false), scores: Array(players).fill(0), turn: first, out };
}

function available(state: Grab): number[] {
  return state.items.flatMap((item, i) => (!state.taken[i] && (item.under === undefined || state.taken[item.under]) ? [i] : []));
}

function inPlayers(state: Grab): number[] {
  return state.scores.map((_, p) => p).filter((p) => !state.out.includes(p));
}

/** Players still in, in turn order after `from`. */
function after(state: Grab, from: number): number[] {
  const n = state.scores.length;
  const order: number[] = [];
  for (let step = 1; step <= n; step++) {
    const p = (from + step) % n;
    if (!state.out.includes(p)) order.push(p);
  }
  return order;
}

export const grabGame: MultiplayerGame<Grab, number, number> = {
  toMove: (s) => s.turn,
  isOver: (s) => available(s).length === 0 || inPlayers(s).length === 0,
  moves: (s) => (grabGame.isOver(s) ? [] : available(s)),
  play: (s, m) => grabGame.playAs(s, s.turn, m),
  players: (s) => (grabGame.isOver(s) ? [] : after(s, s.turn)),
  movesOf: (s, p) => (grabGame.isOver(s) || s.out.includes(p) ? [] : available(s)),
  playAs(s, p, m) {
    if (s.out.includes(p) || !available(s).includes(m)) throw new Error(`Player ${p} cannot take item ${m}`);
    const taken = s.taken.map((t, i) => t || i === m);
    const scores = s.scores.map((v, i) => (i === p ? v + s.items[m]!.value : v));
    return { ...s, taken, scores, turn: after(s, p)[0] ?? p };
  },
  moveKey: (s, _p, m) => s.items[m]!.value,
};

/** Own score minus the best opponent's. */
export const grabEvaluate: Evaluate<Grab, number> = (s, p) => {
  let best = -Infinity;
  s.scores.forEach((v, i) => {
    if (i !== p) best = Math.max(best, v);
  });
  return s.scores[p]! - (best === -Infinity ? 0 : best);
};

/**
 * A = 5 uncovers B = 10, C = 4. One ply ahead A looks best (5 against 4); one reply later it hands
 * the opponent B, while after C the best reply is A.
 */
export const TRAP: readonly Item[] = [{ value: 5 }, { value: 10, under: 0 }, { value: 4 }];
export const A = 0;
export const C = 2;

/** A small seeded generator for the tests (the library has no randomness of its own). */
export function testRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  return { int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

/** A clock that moves `step` ms each time it is read. */
export function steppingClock(step: number): () => number {
  let t = 0;
  return () => (t += step);
}
