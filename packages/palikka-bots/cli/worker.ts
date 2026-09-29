import { parentPort, workerData } from "node:worker_threads";
import type { ScheduledGame } from "game-bots";
import { parseBot, playTournamentGame, type Colours } from "../src/index.js";

/** Plays each game the pool sends and answers with the played game. */
const { colours, labels } = workerData as { colours: Colours; labels: string[] };
const bots = new Map(labels.map((label) => [label, parseBot(label)]));
const port = parentPort!;
port.on("message", (game: ScheduledGame) => {
  try {
    port.postMessage({ ok: true, played: playTournamentGame(colours, bots, game) });
  } catch (error) {
    port.postMessage({ ok: false, error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
  }
});
