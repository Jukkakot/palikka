import type { BotStrategy, BotTurn, BotView } from "./bot.js";
import {
  COL,
  COLLECT,
  DEFAULT_WEIGHTS,
  DISTINCT_ROTATIONS,
  foundBits,
  INSERTION_INDEX,
  newFast,
  OFF_BOARD_DISTANCE,
  PAWN_AFTER,
  queue,
  reach,
  REVERSE,
  ROW,
  scoreTurns,
  shiftInto,
  SIZE,
  toFast,
  type Fast,
  type LookaheadWeights,
  type ScoredTurn,
} from "./botLookahead.js";
import { squareIndex, type Square } from "./geometry.js";
import { INSERTIONS } from "./shift.js";
import { TILE_SET, TREASURES } from "./tileSet.js";
import { targetTileId } from "./treasures.js";
import { nextSeat } from "./turns.js";

/*
 * The sampling bot: the look-ahead's best few choices, each played out a few turns ahead against
 * sampled opponents' targets, the choice with the best average kept. Opponents' real targets are
 * never used: they are drawn from the treasures that could still be anyone's target.
 */

/** Tuning of the sampling bot; the defaults are the tournament winner (see the change's design). */
export interface SamplingOptions {
  /** The look-ahead that proposes the candidates and scores them for ties. */
  readonly weights: LookaheadWeights;
  /** How many of the look-ahead's best choices are played out. */
  readonly candidates: number;
  /** At most this many squares of the same shift among the candidates. */
  readonly perShift: number;
  /**
   * Play-out turns per bot turn, shared out as play-outs per candidate (the same sampled targets
   * and dice for every candidate): more players make longer play-outs and so fewer of them.
   */
  readonly budget: number;
  /** The fewest play-outs per candidate, whatever the budget. */
  readonly minSamples: number;
  /** Rounds played after the bot's turn: every opponent once, then the bot. */
  readonly rounds: number;
  /** How much the opponents' progress counts against the bot's own on a turn that minds them. */
  readonly block: number;
  /** Cost per square of distance to the target at the end of a play-out. */
  readonly distance: number;
  /** Worth of a win in a play-out, in treasures. */
  readonly win: number;
  /** Weight of the look-ahead's own score, so near-equal averages follow it. */
  readonly prior: number;
}

export const DEFAULT_SAMPLING: SamplingOptions = {
  weights: DEFAULT_WEIGHTS,
  candidates: 10,
  perShift: 2,
  budget: 160,
  minSamples: 4,
  rounds: 1,
  block: 0.5,
  distance: 0.1,
  win: 5,
  prior: 0.2,
};

/** Tile ids of the 24 treasures, by treasure bit. */
const TREASURE_TILES: readonly number[] = TREASURES.map((t) => TILE_SET.find((tile) => tile.treasure === t)!.id);

/** A small, fast seeded generator for the play-outs (mulberry32). */
function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sampling strategy from `options`. */
export function samplingStrategy(options: SamplingOptions = DEFAULT_SAMPLING): BotStrategy {
  return (view, rng) => samplingSearch(view, rng, options, false);
}

/** The square to walk to after a shift already made (see `lookaheadMove`), chosen by sampling. */
export function samplingMove(view: BotView, rng: { int(min: number, max: number): number }, options: SamplingOptions = DEFAULT_SAMPLING): Square {
  if (view.lastInsertion === undefined) throw new Error("A move needs the shift just made");
  return samplingSearch(view, rng, options, true).to;
}

/** The candidates to play out: the look-ahead's best, at most `perShift` squares per shift. */
function pickCandidates(all: readonly ScoredTurn[], o: SamplingOptions, fixed: boolean): ScoredTurn[] {
  const sorted = [...all].sort((a, b) => b.score - a.score);
  // Collecting beats everything: then only the collecting choices are compared.
  const collecting = sorted[0]!.score >= COLLECT / 2;
  const perShift = fixed ? o.candidates : o.perShift;
  const perKey = new Map<string, number>();
  const out: ScoredTurn[] = [];
  for (const c of sorted) {
    if (out.length >= o.candidates) break;
    if (collecting && c.score < COLLECT / 2) break;
    const key = `${c.turn.insertion}${c.turn.rotation}`;
    const n = perKey.get(key) ?? 0;
    if (n >= perShift) continue;
    perKey.set(key, n + 1);
    out.push(c);
  }
  return out;
}

function samplingSearch(view: BotView, rng: { int(min: number, max: number): number }, o: SamplingOptions, fixed: boolean): BotTurn {
  const scored = scoreTurns(view, rng, o.weights, fixed);
  // Drawn every turn, so the rng sequence does not depend on the position.
  const seed = rng.int(0, 0x7fffffff);
  // Getting home wins the game: nothing to compare.
  if (view.target === undefined && scored.all.some((c) => c.score >= COLLECT / 2)) return scored.best;
  const candidates = pickCandidates(scored.all, o, fixed);
  if (candidates.length <= 1) return candidates[0]?.turn ?? scored.best;

  // Players in turn order, the bot first.
  const order = [view.seat];
  const taken = view.seats.map((s) => s.seat);
  for (let s = nextSeat(taken, view.seat); s !== view.seat; s = nextSeat(taken, s)) order.push(s);
  const seats = order.map((seat) => view.seats.find((s) => s.seat === seat)!);
  const players = order.length;
  const samples = Math.max(o.minSamples, Math.floor(o.budget / (candidates.length * o.rounds * players)));
  const minCards = Math.min(...seats.map((s) => s.cardsLeft));
  const weight = seats.map((s) => (s.cardsLeft === minCards ? 1 + o.weights.leader : 1));
  const blockWeight = scored.blocking ? o.block : 0;
  const home = order.map((seat) => targetTileId(seat, undefined));
  const ownTile = targetTileId(view.seat, view.target);

  // Treasures that could still be someone's target: not the bot's own, not any found one.
  const excluded = foundBits(view) | (view.target === undefined ? 0 : 2 ** TREASURES.indexOf(view.target));
  const pool = TREASURE_TILES.filter((_, i) => !(excluded & (2 ** i)));

  const root = toFast(view.board);
  const rootPawns = Int8Array.from(seats.map((s) => squareIndex(s.pawn)));
  const cand = candidates.map((c) => {
    const ins = INSERTION_INDEX.get(c.turn.insertion)!;
    const board = newFast();
    const pawns = new Int8Array(players);
    if (fixed) {
      copyFast(root, board);
      pawns.set(rootPawns);
    } else {
      shiftInto(root, board, ins, c.turn.rotation / 90);
      for (let p = 0; p < players; p++) pawns[p] = PAWN_AFTER[ins]![rootPawns[p]!]!;
    }
    pawns[0] = squareIndex(c.turn.to);
    return { board, pawns, ins, total: 0 };
  });

  // Play-out state, reused.
  let b = newFast();
  let tmp = newFast();
  const pawn = new Int8Array(players);
  const target = new Int32Array(players);
  const cards = new Int32Array(players);
  const progress = new Float64Array(players);
  const won = new Uint8Array(players);
  const seen = new Int32Array(SIZE);
  let stamp = 0;
  const deck = [...pool];
  const master = dice(seed);

  for (let s = 0; s < samples; s++) {
    // The sampled deck: opponents' current targets first, then everyone's next ones.
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(master() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    const playSeed = Math.floor(master() * 4294967296);

    for (const c of cand) {
      const rand = dice(playSeed);
      let next = 0;
      const draw = () => (next < deck.length ? deck[next++]! : -1);
      copyFast(c.board, b);
      pawn.set(c.pawns);
      progress.fill(0);
      won.fill(0);
      for (let p = 0; p < players; p++) {
        cards[p] = seats[p]!.cardsLeft;
        target[p] = p === 0 ? ownTile : cards[p] === 0 ? home[p]! : draw();
      }
      let last = c.ins;
      let over = false;

      /** Settles player `p` standing on `at`: collects or wins on its target. */
      const settle = (p: number, at: number) => {
        if (target[p] === -1 || b.ids[at] !== target[p]) return;
        if (cards[p] === 0) {
          won[p] = 1;
          over = true;
          return;
        }
        progress[p]! += 1;
        cards[p]! -= 1;
        target[p] = cards[p] === 0 ? home[p]! : draw();
      };
      settle(0, pawn[0]!);

      for (let r = 0; r < o.rounds && !over; r++) {
        for (let k = 1; k <= players && !over; k++) {
          const p = k % players;
          // The player's greedy turn: collect if some shift allows, else end closest to the target.
          const forbid = REVERSE[last]!;
          let bestScore = -Infinity;
          let bestIns = -1;
          let bestRot = 0;
          let bestTo = 0;
          const t = target[p]!;
          for (let ins = 0; ins < INSERTIONS.length; ins++) {
            if (ins === forbid) continue;
            const start = PAWN_AFTER[ins]![pawn[p]!]!;
            for (const rot of DISTINCT_ROTATIONS[b.spareKind]!) {
              shiftInto(b, tmp, ins, rot);
              const n = reach(tmp, start, seen, ++stamp);
              const at = t === -1 ? -1 : tmp.ids.indexOf(t);
              let score: number;
              let to = start;
              if (at !== -1 && seen[at] === stamp) {
                score = 100;
                to = at;
              } else if (at === -1) {
                score = -OFF_BOARD_DISTANCE;
                to = queue[Math.floor(rand() * n)]!;
              } else {
                let d = 99;
                for (let q = 0; q < n; q++) {
                  const sq = queue[q]!;
                  const dd = Math.abs(ROW[sq]! - ROW[at]!) + Math.abs(COL[sq]! - COL[at]!);
                  if (dd < d) {
                    d = dd;
                    to = sq;
                  }
                }
                score = -d;
              }
              score += rand() * 0.5;
              if (score > bestScore) {
                bestScore = score;
                bestIns = ins;
                bestRot = rot;
                bestTo = to;
              }
            }
          }
          shiftInto(b, tmp, bestIns, bestRot);
          [b, tmp] = [tmp, b];
          const after = PAWN_AFTER[bestIns]!;
          for (let q = 0; q < players; q++) pawn[q] = after[pawn[q]!]!;
          pawn[p] = bestTo;
          last = bestIns;
          settle(p, bestTo);
        }
      }

      // Each player's standing at the end: treasures collected, a win, closeness to the target.
      const standing = (p: number) => {
        if (won[p]) return o.win;
        const at = target[p] === -1 ? -1 : b.ids.indexOf(target[p]!);
        const d = at === -1 ? OFF_BOARD_DISTANCE : Math.abs(ROW[pawn[p]!]! - ROW[at]!) + Math.abs(COL[pawn[p]!]! - COL[at]!);
        return progress[p]! - o.distance * d;
      };
      let theirs = 0;
      for (let p = 1; p < players; p++) theirs += weight[p]! * standing(p);
      c.total += standing(0) - (blockWeight * theirs) / (players - 1);
    }
  }

  let best = 0;
  let bestValue = -Infinity;
  candidates.forEach((c, i) => {
    const value = cand[i]!.total / samples + o.prior * c.score;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  });
  return candidates[best]!.turn;
}

function copyFast(src: Fast, dst: Fast): void {
  dst.masks.set(src.masks);
  dst.kinds.set(src.kinds);
  dst.ids.set(src.ids);
  dst.spareKind = src.spareKind;
  dst.spareId = src.spareId;
}
