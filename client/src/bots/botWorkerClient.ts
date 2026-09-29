import type { Placement } from "@palikka/rules";
import { log } from "../logging/logger.ts";
import type { WorkerAnswer, WorkerQuestion } from "./bot.worker.ts";
import { answer, type AskBot, type MoveRequest } from "./botMoves.ts";

type Pending = { resolve(move: Placement | undefined): void; request: MoveRequest };

let worker: Worker | undefined;
let broken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

/** The one bot worker of the page, created on first use; undefined where workers are missing or broken. */
function botWorker(): Worker | undefined {
  if (worker || broken || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    broken = true;
    log.warn("client.warn", { kind: "bot.worker" }, err instanceof Error ? err.message : String(err));
    return undefined;
  }
  worker.onmessage = (event: MessageEvent<WorkerAnswer>) => {
    const reply = event.data;
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    if ("error" in reply) {
      log.error("client.error", { kind: "bot.worker" }, reply.error);
      entry.resolve(answer(entry.request));
    } else {
      entry.resolve(reply.move);
    }
  };
  worker.onerror = (event) => {
    // A worker that cannot load or crashed: answer everything waiting (and from now on) here instead.
    event.preventDefault();
    broken = true;
    worker?.terminate();
    worker = undefined;
    log.error("client.error", { kind: "bot.worker" }, event.message);
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.resolve(answer(entry.request));
    }
  };
  return worker;
}

/**
 * Asks the bot worker for a move, off the UI thread. Where no worker can run (tests, a failed
 * load), the move is computed here instead, so games never stall.
 */
export const askBotWorker: AskBot = (request) => {
  const target = botWorker();
  if (!target) return Promise.resolve(answer(request));
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, { resolve, request });
    target.postMessage({ id, request } satisfies WorkerQuestion);
  });
};
