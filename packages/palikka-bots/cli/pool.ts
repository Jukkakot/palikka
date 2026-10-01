import { Worker } from "node:worker_threads";
import type { GameResult, MoveTiming, ScheduledGame } from "@game-kit/bots";
import { addTiming, parseBot, playTournamentGame, type Colours, type PlayedGame } from "../src/index.js";

export interface Played {
  readonly games: GameResult[];
  readonly timing: Map<string, MoveTiming>;
}

/** Reports progress on stderr about every tenth of the games (CI logs show the run is alive). */
function progress(total: number): (done: number) => void {
  const step = Math.max(1, Math.ceil(total / 10));
  return (done) => {
    if (done % step === 0 || done === total) process.stderr.write(`  ${done}/${total} games\n`);
  };
}

/**
 * Plays the games on `jobs` worker threads (in this thread when `jobs` is 1), handing each idle
 * worker the next game. The results come back in schedule order whatever order they finish in.
 */
export async function playGames(colours: Colours, labels: readonly string[], games: readonly ScheduledGame[], jobs: number): Promise<Played> {
  const results: GameResult[] = [];
  const timing = new Map<string, MoveTiming>();
  const tick = progress(games.length);
  const collect = (played: PlayedGame) => {
    results.push(played.result);
    addTiming(timing, played.timing);
    tick(results.length);
  };

  if (jobs <= 1) {
    const bots = new Map(labels.map((label) => [label, parseBot(label)]));
    for (const game of games) collect(playTournamentGame(colours, bots, game));
  } else {
    await new Promise<void>((resolve, reject) => {
      let next = 0;
      const workers: Worker[] = [];
      const stop = (error?: Error) => {
        for (const w of workers) void w.terminate();
        if (error) reject(error);
        else resolve();
      };
      const feed = (worker: Worker) => {
        if (next < games.length) worker.postMessage(games[next++]);
        else if (results.length === games.length) stop();
      };
      for (let i = 0; i < Math.min(jobs, games.length); i++) {
        const worker = new Worker(new URL("./worker-entry.mjs", import.meta.url), {
          workerData: { colours, labels },
          execArgv: ["--conditions=source"],
        });
        workers.push(worker);
        worker.on("message", (message: { ok: true; played: PlayedGame } | { ok: false; error: string }) => {
          if (!message.ok) return stop(new Error(message.error));
          collect(message.played);
          feed(worker);
        });
        worker.on("error", (error) => stop(error));
        feed(worker);
      }
    });
  }
  return { games: results.sort((a, b) => a.index - b.index), timing };
}
