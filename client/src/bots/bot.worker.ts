import { answer, type MoveRequest } from "./botMoves.ts";

/** One question from the page: its id comes back with the answer. */
export interface WorkerQuestion {
  id: number;
  request: MoveRequest;
}

export type WorkerAnswer = { id: number; move: ReturnType<typeof answer> } | { id: number; error: string };

// The bot's search runs here, off the page's UI thread.
self.onmessage = (event: MessageEvent<WorkerQuestion>) => {
  const { id, request } = event.data;
  let reply: WorkerAnswer;
  try {
    reply = { id, move: answer(request) };
  } catch (err) {
    reply = { id, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(reply);
};
