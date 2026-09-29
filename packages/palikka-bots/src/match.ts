import { applyMove, createRng, type Move, type Position } from "@palikka/rules";
import type { Bot, Budget } from "game-bots";

/**
 * Plays a whole game from `start` with one bot per colour and one seeded rng for the game. Returns
 * every position on the way, the start included. For tests, benchmarks and tournaments.
 */
export function playGame(
  start: Position,
  bots: Readonly<Record<number, Bot<Position, Move>>>,
  seed: number,
  budget: Budget = { depth: 1 },
): Position[] {
  const rng = createRng(seed);
  const positions = [start];
  let position = start;
  while (!position.ended) {
    const bot = bots[position.turn];
    if (!bot) throw new Error(`No bot for colour ${position.turn}`);
    const move = bot.choose(position, budget, rng);
    if (move === undefined) throw new Error(`Colour ${position.turn} on turn but its bot has no move`);
    const result = applyMove(position, position.turn, move);
    if (!result.ok) throw new Error(`Bot move refused: ${result.code}`);
    position = result.position;
    positions.push(position);
  }
  return positions;
}
