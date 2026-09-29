import { pairwise, type GameResult } from "./schedule.js";

/** A share with its 95 % interval, all in [0, 1]. */
export interface Share {
  readonly share: number;
  readonly low: number;
  readonly high: number;
}

/** What two bots scored against each other, from the first bot's side. */
export interface PairingSummary extends Share {
  readonly a: string;
  readonly b: string;
  readonly games: number;
  /** `a`'s points; `b` has `comparisons - points`. */
  readonly points: number;
  readonly comparisons: number;
}

export interface BotSummary {
  readonly bot: string;
  readonly games: number;
  readonly points: number;
  readonly comparisons: number;
  /** Points per comparison against all other bots. */
  readonly share: number;
  /** Games where one of the bot's seats had the best score (alone or shared). */
  readonly wins: number;
}

export interface Summary {
  readonly pairings: readonly PairingSummary[];
  readonly bots: readonly BotSummary[];
}

const Z95 = 1.96;

/**
 * The 95 % interval of a share measured over correlated comparisons, grouped into independent
 * units (a pairing's seed pairs). The spread between units gives the effective number of
 * independent comparisons (at most `comparisons`; all of them when the units do not vary), and the
 * Wilson score interval on that number keeps the interval inside [0, 1] and non-empty even for a
 * clean sweep. With fewer than two units nothing is known: [0, 1].
 */
export function interval(unitShares: readonly number[], share: number, comparisons: number): Share {
  const n = unitShares.length;
  if (n < 2 || comparisons === 0) return { share, low: 0, high: 1 };
  const mean = unitShares.reduce((s, x) => s + x, 0) / n;
  const standardError2 = unitShares.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) / n;
  const binomial = share * (1 - share);
  const effective = binomial > 0 && standardError2 > 0 ? Math.min(comparisons, binomial / standardError2) : comparisons;
  const z2 = Z95 * Z95;
  const centre = (share + z2 / (2 * effective)) / (1 + z2 / effective);
  const half = (Z95 / (1 + z2 / effective)) * Math.sqrt(binomial / effective + z2 / (4 * effective * effective));
  return { share, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Pairing shares with intervals (seed pairs as the independent unit) and per-bot totals. */
export function summarize(bots: readonly string[], games: readonly GameResult[]): Summary {
  const perBot = new Map(bots.map((bot) => [bot, { games: 0, points: 0, comparisons: 0, wins: 0 }]));
  const pairings = new Map<string, { a: string; b: string; games: number; points: number; comparisons: number; units: Map<number, [number, number]> }>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;

  for (const game of games) {
    const [a, b] = game.pairing;
    let pairing = pairings.get(key(a, b));
    if (!pairing) {
      pairing = { a, b, games: 0, points: 0, comparisons: 0, units: new Map() };
      pairings.set(key(a, b), pairing);
    }
    pairing.games++;
    const unit = pairing.units.get(game.seed) ?? [0, 0];
    for (const c of pairwise(game.seats, game.scores)) {
      const forA = c.a === a ? c.points : 1 - c.points;
      pairing.points += forA;
      pairing.comparisons++;
      unit[0] += forA;
      unit[1]++;
      for (const [bot, points] of [[c.a, c.points], [c.b, 1 - c.points]] as const) {
        const total = perBot.get(bot);
        if (!total) throw new RangeError(`Bot ${bot} is not in the tournament`);
        total.points += points;
        total.comparisons++;
      }
    }
    pairing.units.set(game.seed, unit);
    const best = Math.max(...game.scores);
    for (const bot of new Set(game.seats)) {
      const total = perBot.get(bot)!;
      total.games++;
      if (game.seats.some((seat, i) => seat === bot && game.scores[i] === best)) total.wins++;
    }
  }

  return {
    pairings: [...pairings.values()].map(({ units, ...p }) => {
      const share = p.comparisons === 0 ? 0.5 : p.points / p.comparisons;
      const unitShares = [...units.values()].filter(([, n]) => n > 0).map(([points, n]) => points / n);
      return { ...p, ...interval(unitShares, share, p.comparisons) };
    }),
    bots: bots.map((bot) => {
      const t = perBot.get(bot)!;
      return { bot, ...t, share: t.comparisons === 0 ? 0.5 : t.points / t.comparisons };
    }),
  };
}

/** `a`'s share against `b` (either order), or undefined when they did not meet. */
export function shareOf(summary: Summary, a: string, b: string): Share | undefined {
  for (const p of summary.pairings) {
    if (p.a === a && p.b === b) return p;
    if (p.a === b && p.b === a) return { share: 1 - p.share, low: 1 - p.high, high: 1 - p.low };
  }
  return undefined;
}
