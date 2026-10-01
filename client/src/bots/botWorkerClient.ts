import { botWorkerClient, type WorkerLike } from "@game-kit/bots/worker";
import type { Placement } from "@palikka/rules";
import { log } from "@game-kit/client";
import { answer, type AskBot, type MoveRequest } from "./botMoves.ts";

/**
 * Asks the page's one bot worker for a move, off the UI thread. Where no worker can run (tests, a
 * failed load, a crash), the move is computed here instead, so games never stall.
 */
export const askBotWorker: AskBot = botWorkerClient<MoveRequest, Placement | undefined>({
  create: () =>
    typeof Worker === "undefined"
      ? undefined
      : (new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike<MoveRequest, Placement | undefined>),
  answer,
  onTrouble(trouble, message) {
    if (trouble === "create") log.warn("client.warn", { kind: "bot.worker" }, message);
    else log.error("client.error", { kind: "bot.worker" }, message);
  },
});
