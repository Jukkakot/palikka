import type { Board } from "./board.js";
import type { BotStrategy, BotTurn, BotView } from "./bot.js";
import { ALL_SQUARES, BOARD_SIZE, squareIndex, type Square } from "./geometry.js";
import { insertionLine, INSERTIONS, reverseOf, type InsertionId } from "./shift.js";
import { openings, ROTATIONS, TILE_KINDS, type Rotation, type TileKind } from "./tile.js";
import { TILE_SET, TREASURES } from "./tileSet.js";
import { homeSquare, targetTileId } from "./treasures.js";
import { nextSeat } from "./turns.js";

/*
 * A compact board for the look-ahead bot: open sides as bit masks in typed arrays, so one turn can
 * try every shift, then every next shift after it, without allocating Board objects. Internal to
 * the rules package; the result is checked against the ordinary rules by the tests.
 */

export const SIZE = BOARD_SIZE * BOARD_SIZE;
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const BIT = { N, E, S, W } as const;

/** Open-side mask of every kind at every rotation: MASK[kind][rotation / 90]. */
const MASK: readonly (readonly number[])[] = TILE_KINDS.map((kind) =>
  ROTATIONS.map((rotation) => openings({ id: 0, kind, rotation }).reduce((m, dir) => m | BIT[dir], 0)),
);
const KIND_INDEX = new Map<TileKind, number>(TILE_KINDS.map((k, i) => [k, i]));

/** Each insertion's line of square indices, entry first, exit last. */
export const LINES: readonly Int8Array[] = INSERTIONS.map((id) => Int8Array.from(insertionLine(id).map(squareIndex)));
export const INSERTION_INDEX = new Map<InsertionId, number>(INSERTIONS.map((id, i) => [id, i]));
export const REVERSE: readonly number[] = INSERTIONS.map((id) => INSERTION_INDEX.get(reverseOf(id))!);

/** Where a pawn on each square ends after each insertion (it rides along; pushed off, it wraps to the entry). */
export const PAWN_AFTER: readonly Int8Array[] = LINES.map((line) => {
  const map = Int8Array.from({ length: SIZE }, (_, i) => i);
  for (let k = 0; k < line.length; k++) map[line[k]!] = k === line.length - 1 ? line[0]! : line[k + 1]!;
  return map;
});

/** The one treasure bit of each tile id (0 for a tile without a treasure). */
const TREASURE_BIT: readonly number[] = TILE_SET.map((t) => (t.treasure === undefined ? 0 : 2 ** TREASURES.indexOf(t.treasure)));

export const ROW: readonly number[] = ALL_SQUARES.map((sq) => sq.row);
export const COL: readonly number[] = ALL_SQUARES.map((sq) => sq.col);

export interface Fast {
  masks: Uint8Array;
  kinds: Uint8Array;
  ids: Uint8Array;
  spareKind: number;
  spareId: number;
}

export function newFast(): Fast {
  return { masks: new Uint8Array(SIZE), kinds: new Uint8Array(SIZE), ids: new Uint8Array(SIZE), spareKind: 0, spareId: 0 };
}

export function toFast(board: Board): Fast {
  const f = newFast();
  board.squares.forEach((tile, i) => {
    const kind = KIND_INDEX.get(tile.kind)!;
    f.kinds[i] = kind;
    f.ids[i] = tile.id;
    f.masks[i] = MASK[kind]![tile.rotation / 90]!;
  });
  f.spareKind = KIND_INDEX.get(board.spare.kind)!;
  f.spareId = board.spare.id;
  return f;
}

/** `dst` becomes `src` with the spare pushed in at insertion `ins`, turned `rot` quarter turns. */
export function shiftInto(src: Fast, dst: Fast, ins: number, rot: number): void {
  dst.masks.set(src.masks);
  dst.kinds.set(src.kinds);
  dst.ids.set(src.ids);
  const line = LINES[ins]!;
  const exit = line[line.length - 1]!;
  dst.spareKind = src.kinds[exit]!;
  dst.spareId = src.ids[exit]!;
  for (let k = line.length - 1; k > 0; k--) {
    const to = line[k]!;
    const from = line[k - 1]!;
    dst.masks[to] = src.masks[from]!;
    dst.kinds[to] = src.kinds[from]!;
    dst.ids[to] = src.ids[from]!;
  }
  dst.masks[line[0]!] = MASK[src.spareKind]![rot]!;
  dst.kinds[line[0]!] = src.spareKind;
  dst.ids[line[0]!] = src.spareId;
}

/** The distinct rotations (quarter turns) of a spare of each kind: a straight has only two. */
export const DISTINCT_ROTATIONS: readonly (readonly number[])[] = TILE_KINDS.map((_, kind) => {
  const seen = new Set<number>();
  return [0, 1, 2, 3].filter((r) => {
    const m = MASK[kind]![r]!;
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
});
const distinctRotations = (kind: number) => DISTINCT_ROTATIONS[kind]!;

export const queue = new Int8Array(SIZE);

/**
 * Breadth-first search over connected corridors from `start`: marks every reached square in
 * `seen` with `stamp` and returns how many there are; they are `queue[0…count-1]`.
 */
export function reach(f: Fast, start: number, seen: Int32Array, stamp: number): number {
  const m = f.masks;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = stamp;
  while (head < tail) {
    const i = queue[head++]!;
    const o = m[i]!;
    const c = i % BOARD_SIZE;
    if (o & N && i >= BOARD_SIZE && m[i - BOARD_SIZE]! & S && seen[i - BOARD_SIZE] !== stamp) {
      seen[i - BOARD_SIZE] = stamp;
      queue[tail++] = i - BOARD_SIZE;
    }
    if (o & E && c < BOARD_SIZE - 1 && m[i + 1]! & W && seen[i + 1] !== stamp) {
      seen[i + 1] = stamp;
      queue[tail++] = i + 1;
    }
    if (o & S && i < SIZE - BOARD_SIZE && m[i + BOARD_SIZE]! & N && seen[i + BOARD_SIZE] !== stamp) {
      seen[i + BOARD_SIZE] = stamp;
      queue[tail++] = i + BOARD_SIZE;
    }
    if (o & W && c > 0 && m[i - 1]! & E && seen[i - 1] !== stamp) {
      seen[i - 1] = stamp;
      queue[tail++] = i - 1;
    }
  }
  return tail;
}

function popcount(x: number): number {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
}

/** Tuning of the look-ahead bot; the defaults are the tournament winner (see the change's design). */
export interface LookaheadWeights {
  /** Worth of reaching the target next turn, times the share of next shifts that allow it. */
  readonly reach: number;
  /** Cost per square of average distance to the target over the next shifts. */
  readonly distance: number;
  /** How much the opponents' chances next turn count against a shift (0 = never blocks). */
  readonly block: number;
  /** Extra weight on the leader's chances (fewest cards left): 0.25 = a quarter more. */
  readonly leader: number;
  /**
   * Cost of leaving the next player, when it has no cards left, a shift that takes it home (it
   * would win). Above the widest spread of the bot's own score, so it then blocks the win if it
   * can, but far below collecting its own treasure.
   */
  readonly home: number;
  /**
   * Chance per turn (0…1) that the bot minds its opponents at all; otherwise it plays only for
   * itself. Below 1, so bots cannot lock a game by blocking each other forever, and a person being
   * blocked always gets a way through now and then.
   */
  readonly blockChance: number;
}

export const DEFAULT_WEIGHTS: LookaheadWeights = { reach: 1, distance: 0.1, block: 0.5, leader: 0.25, home: 3, blockChance: 0.8 };

export const COLLECT = 100;
export const WIN = 1000;
/** Distance counted when the target is out on the spare after a shift. */
export const OFF_BOARD_DISTANCE = 7;
const EPSILON = 1e-9;

/**
 * A look-ahead strategy from `weights`. For every allowed shift and reachable square it scores:
 * winning or collecting now; else, over every shift the bot could make next time on the board it
 * leaves, how often its target would be reachable and how far it would be on average. From that
 * it subtracts how well the shift serves the opponents: for each, the share of treasures it could
 * reach with its best next shift (its start corner once it has no cards left), the leader weighed
 * a little higher. Only public information and its own target are used.
 */
export function lookaheadStrategy(weights: LookaheadWeights = DEFAULT_WEIGHTS): BotStrategy {
  return (view, rng) => lookaheadTurn(view, rng, weights);
}

/**
 * The best square to walk to after a shift already made: `view.board` is the shifted board and
 * `view.lastInsertion` the shift just made (its reverse is what the next player may not do). Scored
 * exactly like the second half of a look-ahead turn for that one shift.
 */
export function lookaheadMove(view: BotView, rng: { int(min: number, max: number): number }, weights: LookaheadWeights = DEFAULT_WEIGHTS): Square {
  if (view.lastInsertion === undefined) throw new Error("A move needs the shift just made");
  return search(view, rng, weights, true).to;
}

function lookaheadTurn(view: BotView, rng: { int(min: number, max: number): number }, w: LookaheadWeights): BotTurn {
  return search(view, rng, w, false);
}

/** Bits of every treasure found by anyone: no one's target any more (the deck has no repeats). */
export function foundBits(view: BotView): number {
  let bits = 0;
  for (const seat of view.seats) for (const t of seat.foundTreasures ?? []) bits |= 2 ** TREASURES.indexOf(t);
  return bits;
}

/**
 * The look-ahead search. With `fixed` false it tries every allowed shift of `view.board`; with
 * `fixed` true the shift is already made (`view.board` is the shifted board, `view.lastInsertion`
 * the shift) and only the squares to walk to are compared.
 */
function search(view: BotView, rng: { int(min: number, max: number): number }, w: LookaheadWeights, fixed: boolean): BotTurn {
  return scoreTurns(view, rng, w, fixed).best;
}

/** A turn with its look-ahead score. */
export interface ScoredTurn {
  readonly turn: BotTurn;
  readonly score: number;
}

export interface ScoredTurns {
  /** The look-ahead's own choice (ties broken with the rng). */
  readonly best: BotTurn;
  /** Every choice it compared, with its score, in the order compared. */
  readonly all: readonly ScoredTurn[];
  /** Whether this turn minds the opponents (drawn first, from the rng). */
  readonly blocking: boolean;
}

/**
 * The look-ahead's scores of every choice (see `search`), for strategies that refine its best
 * few choices. Draws from `rng` exactly as the look-ahead turn does.
 */
export function scoreTurns(view: BotView, rng: { int(min: number, max: number): number }, w: LookaheadWeights, fixed: boolean): ScoredTurns {
  const own = view.seats.find((s) => s.seat === view.seat);
  if (!own) throw new Error(`Seat ${view.seat} is not in the view`);
  const heading = view.target === undefined;
  const targetId = targetTileId(view.seat, view.target);
  const ownBit = heading ? 0 : TREASURE_BIT[targetId]!;
  // An opponent may be heading for any treasure but the bot's own target and those already found.
  const possible = 0xffffff & ~ownBit & ~foundBits(view);
  const treasureCount = popcount(possible);
  const me = squareIndex(own.pawn);
  const opponents = view.seats.filter((s) => s.seat !== view.seat);
  const minCards = Math.min(...view.seats.map((s) => s.cardsLeft));
  const oppPawn = opponents.map((o) => squareIndex(o.pawn));
  const oppHome = opponents.map((o) => (o.cardsLeft === 0 ? squareIndex(homeSquare(o.seat)) : -1));
  const oppWeight = opponents.map((o) => (o.cardsLeft === minCards ? 1 + w.leader : 1));
  const nextPlayer = nextSeat(
    view.seats.map((s) => s.seat),
    view.seat,
  );
  // Drawn every turn, first, so the rng sequence does not depend on the position.
  const blocking = rng.int(0, 999) < w.blockChance * 1000 && (w.block > 0 || w.home > 0);

  const b0 = toFast(view.board);
  const b1 = newFast();
  const b2 = newFast();
  const seen = new Int32Array(SIZE);
  const comp = new Int32Array(SIZE);
  let stamp = 0;
  const reachCount = new Float64Array(SIZE);
  const distSum = new Float64Array(SIZE);
  const mine = new Int8Array(SIZE);
  const oppMask = new Array<number>(opponents.length);
  const oppHit = new Array<boolean>(opponents.length);

  let best: BotTurn[] = [];
  let bestScore = -Infinity;
  const all: ScoredTurn[] = [];
  const offer = (score: number, turn: BotTurn) => {
    all.push({ turn, score });
    if (score > bestScore + EPSILON) {
      bestScore = score;
      best = [turn];
    } else if (score >= bestScore - EPSILON) best.push(turn);
  };

  /** Scores every square reachable on `b` after the shift `ins1` (already applied), the pawn on `pawn1`. */
  const evaluate = (b: Fast, ins1: number, rotation: Rotation, pawn1: number) => {
    const insertion = INSERTIONS[ins1]!;
    const count = reach(b, pawn1, seen, ++stamp);
    for (let k = 0; k < count; k++) mine[k] = queue[k]!;
    const target1 = b.ids.indexOf(targetId);

    // Collecting (or winning) now beats anything else; the opponents' chances still break ties.
    const collectable = target1 !== -1 && seen[target1] === stamp;
    for (let k = 0; k < count; k++) {
      reachCount[mine[k]!] = 0;
      distSum[mine[k]!] = 0;
    }
    oppMask.fill(0);
    oppHit.fill(false);
    let next = 0;
    for (let ins2 = 0; ins2 < INSERTIONS.length; ins2++) {
      if (ins2 === REVERSE[ins1]) continue;
      const after = PAWN_AFTER[ins2]!;
      for (const rot2 of distinctRotations(b.spareKind)) {
        shiftInto(b, b2, ins2, rot2);
        next++;
        if (!collectable) {
          const t2 = b2.ids.indexOf(targetId);
          if (t2 !== -1) reach(b2, t2, comp, ++stamp);
          for (let k = 0; k < count; k++) {
            const d = mine[k]!;
            const p = after[d]!;
            if (t2 === -1) distSum[d] += OFF_BOARD_DISTANCE;
            else {
              if (comp[p] === stamp) reachCount[d]++;
              distSum[d] += Math.abs(ROW[p]! - ROW[t2]!) + Math.abs(COL[p]! - COL[t2]!);
            }
          }
        }
        if (blocking) {
          for (let o = 0; o < opponents.length; o++) {
            const reached = reach(b2, after[oppPawn[o]!]!, seen, ++stamp);
            if (oppHome[o] !== -1) {
              if (seen[oppHome[o]!] === stamp) oppHit[o] = true;
              continue;
            }
            let mask = oppMask[o]!;
            for (let k = 0; k < reached; k++) mask |= TREASURE_BIT[b2.ids[queue[k]!]!]!;
            oppMask[o] = mask;
          }
        }
      }
    }

    // The opponents count evenly (their mean chance), so blocking does not grow with the seat count.
    let chances = 0;
    let wins = 0;
    for (let o = 0; o < opponents.length; o++) {
      if (oppHome[o] !== -1) {
        // Only the next player shifts the very board the bot leaves; later ones count as a sure chance.
        if (!oppHit[o]) continue;
        if (opponents[o]!.seat === nextPlayer) wins += oppWeight[o]!;
        else chances += oppWeight[o]!;
      } else if (treasureCount > 0) chances += (oppWeight[o]! * popcount(oppMask[o]! & possible)) / treasureCount;
    }
    const penalty = (w.block * chances) / Math.max(1, opponents.length) + w.home * wins;

    for (let k = 0; k < count; k++) {
      const d = mine[k]!;
      const to = ALL_SQUARES[d]!;
      let score: number;
      if (collectable) {
        if (d !== target1) continue;
        score = (heading ? WIN : COLLECT) - penalty;
      } else {
        score = (w.reach * reachCount[d]!) / next - (w.distance * distSum[d]!) / next - penalty;
      }
      offer(score, { insertion, rotation, to });
    }
  };

  if (fixed) {
    const ins1 = INSERTION_INDEX.get(view.lastInsertion!)!;
    // The shift is made: the pawn is where it stands, the inserted tile sits on the line's entry.
    const rotation = view.board.squares[LINES[ins1]![0]!]!.rotation;
    evaluate(b0, ins1, rotation, me);
  } else {
    const forbidden = view.lastInsertion === undefined ? -1 : REVERSE[INSERTION_INDEX.get(view.lastInsertion)!]!;
    for (let ins1 = 0; ins1 < INSERTIONS.length; ins1++) {
      if (ins1 === forbidden) continue;
      for (const rot1 of distinctRotations(b0.spareKind)) {
        shiftInto(b0, b1, ins1, rot1);
        evaluate(b1, ins1, ROTATIONS[rot1]! as Rotation, PAWN_AFTER[ins1]![me]!);
      }
    }
  }
  return { best: best[rng.int(0, best.length - 1)]!, all, blocking };
}
