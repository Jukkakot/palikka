import {
  emptyBits,
  forbiddenSquares,
  freeCorners,
  rowMask,
  scores,
  sideOf,
  winners,
  type Bits,
  type Position,
} from "@palikka/rules";

/**
 * Hand-set weights of the greedy evaluation (tuned later by tournaments). Units: one square placed.
 */
export const WEIGHTS = {
  /** Per point of the colour's own score (squares placed, end bonuses). */
  score: 1,
  /** Per free corner square more than the opponents' average. */
  corners: 1,
  /** Per square of exclusive reach more than the opponents' average. */
  area: 0.25,
  /** King steps from the free corners that count as reach. */
  reachSteps: 2,
  /** Added for a won (or shared) ended game, subtracted for a lost one. */
  result: 1000,
} as const;

export function popcount(word: number): number {
  let x = word - ((word >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function countBits(bits: Bits): number {
  let n = 0;
  for (let r = 0; r < bits.length; r++) n += popcount(bits[r]!);
  return n;
}

/**
 * Squares the colour could cover within `steps` king steps of its free corners, moving only through
 * squares it may still cover (free corners included).
 */
export function reachOf(position: Position, colour: number, steps: number): Bits {
  const { size } = position.config;
  const mask = rowMask(size);
  const forbidden = forbiddenSquares(position, colour);
  const reached = freeCorners(position, colour);
  const wide = emptyBits(size);
  for (let step = 0; step < steps; step++) {
    for (let r = 0; r < size; r++) {
      const w = reached[r]!;
      wide[r] = w | (w << 1) | (w >>> 1);
    }
    for (let r = 0; r < size; r++) {
      const grown = wide[r]! | (r > 0 ? wide[r - 1]! : 0) | (r + 1 < size ? wide[r + 1]! : 0);
      reached[r] = grown & ~forbidden[r]! & mask;
    }
  }
  return reached;
}

/** Groups colours by side: a side's colours share a key; a shared colour (side 0) is its own group. */
export function teamKey(position: Position, colour: number): number {
  const side = sideOf(position, colour);
  return side === 0 ? -colour : side;
}

/**
 * Rates `position` for `colour`'s side (higher is better), meant for the position right after its
 * move: the side's score, its free corners and exclusive reach against the opposing colours still in
 * (so blocking them counts), and the result once the game has ended. With one colour per side (Perus)
 * this is the colour against every other colour; a partner colour is never an opponent.
 */
export function evaluate(position: Position, colour: number): number {
  const key = teamKey(position, colour);
  const team = position.colours.filter((c) => teamKey(position, c) === key);
  const own = scores(position)
    .filter((s) => team.includes(s.colour))
    .reduce((sum, s) => sum + s.score, 0);
  if (position.ended) {
    return own + (winners(position).includes(sideOf(position, colour)) ? WEIGHTS.result : -WEIGHTS.result);
  }
  const active = (c: number) => !position.out.includes(c);
  const opponents = position.colours.filter((c) => !team.includes(c) && active(c));

  const reach = new Map<number, Bits>();
  for (const c of position.colours) if (active(c)) reach.set(c, reachOf(position, c, WEIGHTS.reachSteps));
  // Squares only `c`'s side can reach: partners do not take them away from each other.
  const exclusive = (c: number): number => {
    const bits = reach.get(c);
    if (!bits) return 0;
    const side = teamKey(position, c);
    let n = 0;
    for (let r = 0; r < bits.length; r++) {
      let others = 0;
      for (const [o, b] of reach) if (teamKey(position, o) !== side) others |= b[r]!;
      n += popcount(bits[r]! & ~others);
    }
    return n;
  };
  const corners = (c: number) => countBits(freeCorners(position, c));
  const average = (f: (c: number) => number) =>
    opponents.length === 0 ? 0 : opponents.reduce((sum, c) => sum + f(c), 0) / opponents.length;
  const ours = (f: (c: number) => number) => team.filter(active).reduce((sum, c) => sum + f(c), 0);

  const cornerTerm = ours(corners) - average(corners);
  const areaTerm = ours(exclusive) - average(exclusive);
  return WEIGHTS.score * own + WEIGHTS.corners * cornerTerm + WEIGHTS.area * areaTerm;
}
