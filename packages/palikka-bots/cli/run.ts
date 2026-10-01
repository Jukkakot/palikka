import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schedule, tournamentResult, type TournamentResult } from "@game-kit/bots";
import { FORMATS, isTimeLimited, parseBot, type Colours } from "../src/index.js";
import { playGames } from "./pool.js";

export const LIMITS = { maxBots: 8, maxGames: 10_000, maxJobs: 64 };

/** Where results files go by default: git-ignored, inside this package. */
export const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tournament-results");

export interface TournamentOptions {
  readonly bots: readonly string[];
  readonly colours: Colours;
  readonly games: number;
  readonly seed: number;
  readonly jobs: number;
}

/** The short commit the run is built from: CI's `GITHUB_SHA`, else git, else "unknown". */
export function codeVersion(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

/** Checks the options against the limits; throws a RangeError with a readable message. */
export function checkOptions(options: TournamentOptions): void {
  const { bots, games, jobs } = options;
  if (bots.length > LIMITS.maxBots) throw new RangeError(`At most ${LIMITS.maxBots} bots, got ${bots.length}`);
  if (!Number.isInteger(games) || games < 2 || games > LIMITS.maxGames || games % 2 !== 0) {
    throw new RangeError(`--games must be an even number from 2 to ${LIMITS.maxGames}, got ${games}`);
  }
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > LIMITS.maxJobs) throw new RangeError(`--jobs must be 1–${LIMITS.maxJobs}, got ${jobs}`);
  if (!Number.isInteger(options.seed) || options.seed < 0) throw new RangeError(`--seed must be a non-negative integer, got ${options.seed}`);
  for (const bot of bots) parseBot(bot);
}

/** Plays a whole tournament and rates it. */
export async function runTournament(options: TournamentOptions): Promise<TournamentResult> {
  checkOptions(options);
  const games = schedule(options.bots, options.games, options.seed);
  const played = await playGames(options.colours, options.bots, games, options.jobs);
  const setup = {
    bots: options.bots,
    format: FORMATS[options.colours].description,
    gamesPerPairing: options.games,
    firstSeed: options.seed,
    timeLimited: isTimeLimited(options.bots.map(parseBot)),
    version: codeVersion(),
    jobs: options.jobs,
  };
  return tournamentResult(setup, played.games, played.timing);
}

/** A tournament result as plain JSON (maps become objects). */
export function toJson(result: TournamentResult): unknown {
  return {
    setup: result.setup,
    ratings: Object.fromEntries(result.ratings),
    pairings: result.summary.pairings,
    bots: result.summary.bots,
    timing: result.timing ? Object.fromEntries(result.timing) : undefined,
    games: result.games,
  };
}

/** Writes `data` as JSON to `path` (creating folders) and returns the path. */
export function writeJson(path: string, data: unknown): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

/** A default results file name: what ran and when. */
export function defaultOut(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(RESULTS_DIR, `${prefix.replace(/[^a-z0-9@-]+/gi, "_")}-${stamp}.json`);
}
