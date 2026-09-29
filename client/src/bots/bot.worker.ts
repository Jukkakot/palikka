import { serveBotWorker, type WorkerScopeLike } from "game-bots/worker";
import type { Placement } from "@palikka/rules";
import { answer, type MoveRequest } from "./botMoves.ts";

// The bot's search runs here, off the page's UI thread.
serveBotWorker(self as unknown as WorkerScopeLike<MoveRequest, Placement | undefined>, answer);
