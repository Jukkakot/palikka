import {
  applyMove,
  createRng,
  decodeMove,
  legalMoves,
  placementText,
  withTurn,
  type Move,
  type Placement,
  type Position,
  type Rng,
} from "@palikka/rules";
import { bestReplyBot, greedyBot, mctsBot, randomBot, type Bot, type Budget, type MultiplayerGame } from "game-bots";
import { evaluate } from "./evaluation.js";
import { moveKey } from "./moveKey.js";

function played(position: Position, colour: number, move: Move): Position {
  const result = applyMove(withTurn(position, colour), colour, move);
  if (!result.ok) {
    throw new Error(`Bot move ${placementText(decodeMove(move, position.config.size))} for colour ${colour} refused: ${result.code}`);
  }
  return result.position;
}

/**
 * Palikka as the bot library sees it: positions, integer move codes, colours as players. Search
 * may ask any colour still in for its moves and play one out of turn; the rules then carry on
 * from that colour (automatic passing included).
 */
export const palikkaGame: MultiplayerGame<Position, Move, number> = {
  toMove: (position) => position.turn,
  isOver: (position) => position.ended,
  moves: (position) => (position.ended ? [] : legalMoves(position, position.turn)),
  play: (position, move) => played(position, position.turn, move),
  players(position) {
    if (position.ended) return [];
    const { colours } = position;
    const from = colours.indexOf(position.turn);
    const order: number[] = [];
    for (let step = 1; step <= colours.length; step++) {
      const colour = colours[(from + step) % colours.length]!;
      if (!position.out.includes(colour)) order.push(colour);
    }
    return order;
  },
  movesOf: (position, colour) =>
    position.ended || position.out.includes(colour) || !position.colours.includes(colour) ? [] : legalMoves(withTurn(position, colour), colour),
  playAs: played,
  moveKey,
};

/** Bot v1: one ply, greedy on `evaluate`. Also the hint's bot (fast). */
export const greedyPlayer: Bot<Position, Move> = greedyBot(palikkaGame, evaluate);

/** Best-reply search on `evaluate` with the cheap move key. */
export const brsPlayer: Bot<Position, Move> = bestReplyBot(palikkaGame, evaluate);

/** Multi-player MCTS on `evaluate` with the cheap move key. */
export const mctsPlayer: Bot<Position, Move> = mctsBot(palikkaGame, evaluate);

/** Uniformly random legal moves: the baseline for tests and tournaments. */
export const randomPlayer: Bot<Position, Move> = randomBot(palikkaGame);

/** The bot people play against: the strongest measured at the device's time budget (bot-search design). */
export const devicePlayer: Bot<Position, Move> = brsPlayer;

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
  bot: Bot<Position, Move> = devicePlayer,
): Placement | undefined {
  if (position.ended || !position.colours.includes(colour) || position.out.includes(colour)) return undefined;
  const move = bot.choose(withTurn(position, colour), budget, typeof rng === "number" ? createRng(rng) : rng);
  return move === undefined ? undefined : decodeMove(move, position.config.size);
}
