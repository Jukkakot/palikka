import type { Summary } from "./summary.js";

/** The anchor's rating: the Elo scale's zero point for a tournament. */
export const ANCHOR_ELO = 1000;

/** Default anchor: `random` when it takes part (a stable zero point across runs), else the first bot. */
export function defaultAnchor(bots: readonly string[]): string {
  const first = bots[0];
  if (first === undefined) throw new RangeError("No bots to anchor");
  return bots.includes("random") ? "random" : first;
}

/**
 * Elo ratings from all pairwise results together: Bradley–Terry maximum likelihood (draws count
 * half a win each), fitted with the minorization–maximization iteration. Uses only each pairing's
 * totals, so the order of games does not matter. Every pairing that played gets one extra virtual
 * draw, which keeps a clean sweep finite. The anchor is rated 1000.
 */
export function rate(summary: Summary, anchor: string = defaultAnchor(summary.bots.map((b) => b.bot))): Map<string, number> {
  const bots = summary.bots.map((b) => b.bot);
  const index = new Map(bots.map((bot, i) => [bot, i]));
  if (!index.has(anchor)) throw new RangeError(`Anchor ${anchor} is not in the tournament`);
  const n = bots.length;
  const wins = new Array<number>(n).fill(0);
  const games: number[][] = bots.map(() => new Array<number>(n).fill(0));
  for (const p of summary.pairings) {
    if (p.comparisons === 0) continue;
    const i = index.get(p.a)!;
    const j = index.get(p.b)!;
    wins[i]! += p.points + 0.5;
    wins[j]! += p.comparisons - p.points + 0.5;
    games[i]![j]! += p.comparisons + 1;
    games[j]![i]! += p.comparisons + 1;
  }

  let gamma = new Array<number>(n).fill(1);
  for (let iteration = 0; iteration < 10_000; iteration++) {
    const next = gamma.map((g, i) => {
      let denominator = 0;
      for (let j = 0; j < n; j++) if (games[i]![j]! > 0) denominator += games[i]![j]! / (g + gamma[j]!);
      return denominator === 0 ? g : wins[i]! / denominator;
    });
    // Keep the scale fixed (geometric mean 1) so the numbers stay well-conditioned.
    const logMean = next.reduce((s, g) => s + Math.log(g), 0) / n;
    const scaled = next.map((g) => g / Math.exp(logMean));
    const change = Math.max(...scaled.map((g, i) => Math.abs(g - gamma[i]!) / gamma[i]!));
    gamma = scaled;
    if (change < 1e-12) break;
  }

  const base = gamma[index.get(anchor)!]!;
  return new Map(bots.map((bot, i) => [bot, ANCHOR_ELO + 400 * Math.log10(gamma[i]! / base)]));
}
