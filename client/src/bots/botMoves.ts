import { chooseMove, type Budget } from "@palikka/bots";
import type { Placement, Position } from "@palikka/rules";

/**
 * What the game asks a bot: `colour`'s move in `position` within `budget`, seeded so the same
 * question gets the same answer. Plain data, so it crosses the Web Worker boundary as is.
 */
export interface MoveRequest {
  readonly position: Position;
  readonly colour: number;
  readonly budget: Budget;
  readonly seed: number;
}

/** Asks for a bot move; resolves undefined when the colour has no move. */
export type AskBot = (request: MoveRequest) => Promise<Placement | undefined>;

/** The pause before a bot's move, so people can follow it (the server uses the same). */
export const BOT_DELAY_MS = 1_000;

/** The budget of one bot move: it thinks during the pause people see before it moves, with a margin. */
export const BOT_BUDGET = { timeMs: 800 } as const satisfies Budget;

/** The budget at a watching speed: the pause shrinks with the speed, and so does the thinking. */
export function botBudget(speed = 1): Budget {
  return { timeMs: BOT_BUDGET.timeMs / speed };
}

/** The bot's answer, computed right here (the worker runs this; so do tests and old browsers). */
export function answer({ position, colour, budget, seed }: MoveRequest): Placement | undefined {
  return chooseMove(position, colour, budget, seed);
}
