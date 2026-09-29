import { rate } from "./rating.js";
import { shareOf, summarize, type Summary } from "./summary.js";
import type { GameResult } from "./schedule.js";

/** How a tournament was set up, as the report shows it. */
export interface TournamentSetup {
  /** Bot names as used in the games (budget included, e.g. `greedy@200ms`). */
  readonly bots: readonly string[];
  /** The game's own words for the format, e.g. "4 colours, classic board". */
  readonly format: string;
  readonly gamesPerPairing: number;
  readonly firstSeed: number;
  /** A time limit made the results depend on the machine. */
  readonly timeLimited: boolean;
  readonly version: string;
  readonly jobs?: number;
}

/** Per-bot move timing measured by the game, for the report only. */
export interface MoveTiming {
  readonly moves: number;
  readonly totalMs: number;
  readonly maxMs: number;
}

export interface TournamentResult {
  readonly setup: TournamentSetup;
  readonly games: readonly GameResult[];
  readonly summary: Summary;
  readonly ratings: ReadonlyMap<string, number>;
  readonly timing?: ReadonlyMap<string, MoveTiming>;
}

/** Summary and ratings of played games, in schedule order. */
export function tournamentResult(
  setup: TournamentSetup,
  games: readonly GameResult[],
  timing?: ReadonlyMap<string, MoveTiming>,
): TournamentResult {
  const sorted = [...games].sort((x, y) => x.index - y.index);
  const summary = summarize(setup.bots, sorted);
  return { setup, games: sorted, summary, ratings: rate(summary), ...(timing ? { timing } : {}) };
}

const percent = (x: number) => `${(x * 100).toFixed(1)} %`;

/** The report as Markdown: setup, standings by rating, and each pairing's share with its interval. */
export function markdownReport(result: TournamentResult): string {
  const { setup, summary, ratings, timing } = result;
  const lines: string[] = [];
  const jobs = setup.jobs === undefined ? "" : `, ${setup.jobs} jobs`;
  lines.push(
    `**Tournament** ${setup.bots.join(" · ")} — ${setup.format}, ${setup.gamesPerPairing} games per pairing, first seed ${setup.firstSeed}${jobs}, version ${setup.version}`,
  );
  if (setup.timeLimited) lines.push("", "_Time-limited: results depend on the machine._");

  const standings = [...summary.bots].sort((x, y) => ratings.get(y.bot)! - ratings.get(x.bot)!);
  lines.push("", "| # | Bot | Elo | Games | Share | Game wins | ms/move avg | ms/move max |", "|---|---|---:|---:|---:|---:|---:|---:|");
  standings.forEach((b, rank) => {
    const t = timing?.get(b.bot);
    const avg = t && t.moves > 0 ? (t.totalMs / t.moves).toFixed(1) : "–";
    const max = t && t.moves > 0 ? t.maxMs.toFixed(1) : "–";
    const wins = b.games === 0 ? "–" : percent(b.wins / b.games);
    lines.push(`| ${rank + 1} | ${b.bot} | ${Math.round(ratings.get(b.bot)!)} | ${b.games} | ${percent(b.share)} | ${wins} | ${avg} | ${max} |`);
  });

  const order = standings.map((b) => b.bot);
  lines.push("", "Share of the row bot against the column bot (95 % interval):", "", `| | ${order.join(" | ")} |`, `|---|${order.map(() => "---:").join("|")}|`);
  for (const row of order) {
    const cells = order.map((column) => {
      if (row === column) return "–";
      const s = shareOf(summary, row, column);
      return s ? `${percent(s.share)} (${percent(s.low)}–${percent(s.high)})` : "";
    });
    lines.push(`| **${row}** | ${cells.join(" | ")} |`);
  }
  return lines.join("\n") + "\n";
}

/** "Candidate beats baseline with a share of at least `minShare`." */
export interface StrengthRequirement {
  readonly name: string;
  readonly candidate: string;
  readonly baseline: string;
  readonly minShare: number;
}

export interface RequirementCheck {
  readonly requirement: StrengthRequirement;
  readonly share: number;
  readonly passed: boolean;
  /** One line for the log, e.g. `PASS greedy beats random: 97.5 % ≥ 90.0 %`. */
  readonly line: string;
}

/** Whether the candidate's measured share against the baseline meets the requirement. */
export function checkRequirement(requirement: StrengthRequirement, summary: Summary): RequirementCheck {
  const measured = shareOf(summary, requirement.candidate, requirement.baseline);
  if (!measured) throw new RangeError(`${requirement.candidate} and ${requirement.baseline} did not play each other`);
  const passed = measured.share >= requirement.minShare;
  const line = `${passed ? "PASS" : "FAIL"} ${requirement.name}: ${percent(measured.share)} ${passed ? "≥" : "<"} ${percent(requirement.minShare)}`;
  return { requirement, share: measured.share, passed, line };
}
