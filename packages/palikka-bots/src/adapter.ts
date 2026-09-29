import {
  applyMove,
  createRng,
  decodeMove,
  legalMoves,
  placementText,
  type Move,
  type Placement,
  type Position,
  type Rng,
} from "@palikka/rules";
import { greedyBot, randomBot, type Bot, type Budget, type Game } from "game-bots";
import { evaluate } from "./evaluation.js";

/** Palikka as the bot library sees it: positions, integer move codes, colours as players. */
export const palikkaGame: Game<Position, Move, number> = {
  toMove: (position) => position.turn,
  isOver: (position) => position.ended,
  moves: (position) => (position.ended ? [] : legalMoves(position, position.turn)),
  play(position, move) {
    const result = applyMove(position, position.turn, move);
    if (!result.ok) {
      throw new Error(`Bot move ${placementText(decodeMove(move, position.config.size))} refused: ${result.code}`);
    }
    return result.position;
  },
};

/** Bot v1: one ply, greedy on `evaluate`. */
export const greedyPlayer: Bot<Position, Move> = greedyBot(palikkaGame, evaluate);

/** Uniformly random legal moves: the baseline for tests and tournaments. */
export const randomPlayer: Bot<Position, Move> = randomBot(palikkaGame);

/**
 * The bot worker's entry point: `colour`'s move in `position` within `budget`, or undefined when
 * the game has ended or the colour is out. Deterministic for a given seed (a number) or rng, as
 * long as a time budget does not run out. If `colour` is not on turn, it answers as if it were.
 */
export function chooseMove(
  position: Position,
  colour: number,
  budget: Budget,
  rng: Rng | number,
  bot: Bot<Position, Move> = greedyPlayer,
): Placement | undefined {
  if (position.ended || !position.colours.includes(colour) || position.out.includes(colour)) return undefined;
  const state = position.turn === colour ? position : { ...position, turn: colour };
  const move = bot.choose(state, budget, typeof rng === "number" ? createRng(rng) : rng);
  return move === undefined ? undefined : decodeMove(move, position.config.size);
}
