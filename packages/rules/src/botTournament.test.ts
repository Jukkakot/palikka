import { describe, expect, it } from "vitest";
import { greedyBotTurn } from "./bot.js";
import { lookaheadStrategy } from "./botLookahead.js";
import { samplingStrategy } from "./botSampling.js";
import { runTournament } from "./botTournament.js";

// The rules package has no Node types; the test runner is Node all the same.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** Games per lineup with `BOT_TOURNAMENT=<n>`; the tournament is skipped otherwise (it takes minutes). */
const log = (globalThis as { console?: { log(text: string): void } }).console?.log ?? (() => undefined);
const GAMES = Number(env.BOT_TOURNAMENT ?? 0);

const strategies = { sampling: samplingStrategy(), lookahead: lookaheadStrategy(), greedy: greedyBotTurn };
const lineups: string[][] = [
  ["sampling", "lookahead"],
  ["sampling", "lookahead", "lookahead"],
  ["sampling", "lookahead", "lookahead", "lookahead"],
  ["lookahead", "greedy"],
  ["sampling", "sampling", "sampling", "sampling"],
  ["lookahead", "lookahead", "lookahead", "lookahead"],
];

describe.skipIf(!GAMES)("bots › Bot tournament", () => {
  for (const lineup of lineups) {
    it(`${lineup.join(" vs ")}: ${GAMES} games`, { timeout: 60 * 60 * 1000 }, () => {
      const result = runTournament(strategies, lineup, GAMES);
      const lines = [...result.standings]
        .filter(([, s]) => s.games > 0)
        .map(([name, s]) => `${name}: ${s.wins}/${s.games} wins (${((100 * s.wins) / s.games).toFixed(0)} %), ${s.meanMs.toFixed(1)} ms/turn mean, ${s.maxMs.toFixed(0)} ms max`);
      log(`[${lineup.join(" vs ")}] mean ${result.meanTurns.toFixed(0)} turns, ${result.unfinished} unfinished\n  ${lines.join("\n  ")}`);
      expect(result.unfinished).toBe(0);
    });
  }
});
