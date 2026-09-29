/** One game of a tournament before it is played. */
export interface ScheduledGame {
  /** Position in the schedule; results are reported in this order whatever order they finish in. */
  readonly index: number;
  /** The two bots of the pairing, in the order they were named. */
  readonly pairing: readonly [string, string];
  readonly seed: number;
  /** False: the first bot of the pairing takes the game's first seat arrangement; true: the second. */
  readonly swapped: boolean;
}

/** A played game: which bot sat in each seat and each seat's final score. */
export interface GameResult extends ScheduledGame {
  readonly seats: readonly string[];
  readonly scores: readonly number[];
}

/**
 * The games of a round robin: every two bots (in the order named) play `gamesPerPairing` games.
 * Game k of a pairing uses seed `firstSeed + ⌊k / 2⌋` and is swapped when k is odd, so each seed is
 * played once from each side, and every pairing sees the same seeds.
 */
export function schedule(bots: readonly string[], gamesPerPairing: number, firstSeed: number): ScheduledGame[] {
  if (bots.length < 2) throw new RangeError("A tournament needs at least two bots");
  if (new Set(bots).size !== bots.length) throw new RangeError(`A bot is named twice: ${bots.join(", ")}`);
  if (!Number.isInteger(gamesPerPairing) || gamesPerPairing < 2 || gamesPerPairing % 2 !== 0) {
    throw new RangeError(`Games per pairing must be an even number of at least 2, got ${gamesPerPairing}`);
  }
  const games: ScheduledGame[] = [];
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      for (let k = 0; k < gamesPerPairing; k++) {
        games.push({ index: games.length, pairing: [bots[i]!, bots[j]!], seed: firstSeed + Math.floor(k / 2), swapped: k % 2 === 1 });
      }
    }
  }
  return games;
}

/** One comparison between two seats of different bots: `points` for `a` (1, ½ or 0), `1 - points` for `b`. */
export interface Comparison {
  readonly a: string;
  readonly b: string;
  readonly points: number;
}

/**
 * A finished game as pairwise results: every two seats played by different bots are compared by
 * final score; higher wins (1), equal draws (½ each). Seats of the same bot are not compared.
 */
export function pairwise(seats: readonly string[], scores: readonly number[]): Comparison[] {
  if (seats.length !== scores.length) throw new RangeError("One score per seat");
  const out: Comparison[] = [];
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      if (seats[i] === seats[j]) continue;
      const diff = scores[i]! - scores[j]!;
      out.push({ a: seats[i]!, b: seats[j]!, points: diff > 0 ? 1 : diff < 0 ? 0 : 0.5 });
    }
  }
  return out;
}
