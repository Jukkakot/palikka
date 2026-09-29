/**
 * Checks the strength requirements in strength.json: plays each as a two-bot match, prints a
 * PASS/FAIL line and the report per requirement, and exits 1 when any requirement is missed.
 *
 *   npm run strength -w @palikka/bots [-- --jobs <cores>] [--out file.json] [--summary file.md]
 */
import { appendFileSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { checkRequirement, markdownReport, type StrengthRequirement } from "game-bots";
import { isColours } from "../src/index.js";
import { defaultOut, runTournament, toJson, writeJson } from "./run.js";

interface Requirement extends StrengthRequirement {
  readonly colours: number;
  readonly games: number;
  readonly seed: number;
}

const REQUIREMENTS = new URL("../strength.json", import.meta.url);

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      jobs: { type: "string", default: String(availableParallelism()) },
      out: { type: "string" },
      summary: { type: "string" },
    },
  });
  const requirements = JSON.parse(readFileSync(REQUIREMENTS, "utf8")) as Requirement[];
  const lines: string[] = [];
  const reports: string[] = [];
  const results: unknown[] = [];
  for (const requirement of requirements) {
    const { colours } = requirement;
    if (!isColours(colours)) throw new RangeError(`${requirement.name}: colours must be 4 or 2, got ${colours}`);
    console.error(`${requirement.name}: ${requirement.games} games…`);
    const result = await runTournament({
      bots: [requirement.baseline, requirement.candidate],
      colours,
      games: requirement.games,
      seed: requirement.seed,
      jobs: Number(values.jobs),
    });
    const check = checkRequirement(requirement, result.summary);
    lines.push(check.line);
    reports.push(`### ${requirement.name}\n\n${markdownReport(result)}`);
    results.push({ requirement, share: check.share, passed: check.passed, result: toJson(result) });
  }
  const failed = lines.filter((line) => line.startsWith("FAIL")).length;
  const text = [
    `## Strength requirements: ${failed === 0 ? "all met" : `${failed} missed`}`,
    "",
    ...lines.map((line) => `- ${line}`),
    "",
    ...reports,
  ].join("\n");
  console.log(text);
  const out = writeJson(values.out ?? defaultOut("strength"), results);
  console.error(`Results: ${out}`);
  if (values.summary) appendFileSync(values.summary, text + "\n");
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof RangeError ? error.message : error);
  process.exit(error instanceof RangeError ? 2 : 1);
});
