/**
 * Plays a round-robin tournament between named bots and prints the Markdown report.
 *
 *   npm run tournament -w @palikka/bots -- random greedy [--games 100] [--colours 4|2|duo] [--seed 1]
 *     [--jobs <cores>] [--out file.json] [--summary file.md]
 *
 * Bots: a name from the registry with an optional budget: greedy, greedy@200ms, greedy@d2.
 */
import { appendFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { markdownReport } from "game-bots";
import { parseColours } from "../src/index.js";
import { defaultOut, runTournament, toJson, writeJson } from "./run.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      games: { type: "string", default: "100" },
      colours: { type: "string", default: "4" },
      seed: { type: "string", default: "1" },
      jobs: { type: "string", default: String(availableParallelism()) },
      out: { type: "string" },
      summary: { type: "string" },
    },
  });
  const colours = parseColours(values.colours);
  const started = performance.now();
  const result = await runTournament({
    bots: positionals,
    colours,
    games: Number(values.games),
    seed: Number(values.seed),
    jobs: Number(values.jobs),
  });
  const report = markdownReport(result) + `\n_${result.games.length} games in ${((performance.now() - started) / 1000).toFixed(1)} s._\n`;
  console.log(report);
  const out = writeJson(values.out ?? defaultOut(positionals.join("-")), toJson(result));
  console.error(`Results: ${out}`);
  if (values.summary) appendFileSync(values.summary, report + "\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof RangeError ? error.message : error);
  process.exit(error instanceof RangeError ? 2 : 1);
});
