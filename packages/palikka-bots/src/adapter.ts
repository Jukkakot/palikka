import {
  applyMove,
  createRng,
  decodeMove,
  legalMoves,
  placementText,
  sideOf,
  withTurn,
  type Move,
  type Placement,
  type Position,
  type Rng,
} from "@palikka/rules";
import { bestReplyBot, greedyBot, mctsBot, randomBot, type Bot, type Budget, type MultiplayerGame } from "game-bots";
import { evaluate, teamKey } from "./evaluation.js";
import { moveKey } from "./moveKey.js";

function played(position: Position, colour: number, move: Move): Position {
  const result = applyMove(withTurn(position, colour), colour, move);
  if (!result.ok) {
    throw new Error(`Bot move ${placementText(decodeMove(move, position.config.size))} for colour ${colour} refused: ${result.code}`);
  }
  return result.position;
}

/**
 * Palikka as the bot library sees it: positions, integer move codes, colours as players (a colour
 * plays for its side, `Position.sides`). Search
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
  // Partner colours (the same side) never answer as opponents; the shared colour opposes everyone.
  opponents: (position, colour) => palikkaGame.players(position).filter((c) => teamKey(position, c) !== teamKey(position, colour)),
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
 * The shared colour's move for the seat that plays it this time: the legal move best for
 * `viewpoint`'s side one ply deep, ties broken by `rng`. Its search stays one ply because the side it
 * plays for changes every turn (variants design).
 */
function sharedMove(position: Position, colour: number, viewpoint: number, rng: Rng): Move | undefined {
  const onTurn = withTurn(position, colour);
  let best: Move[] = [];
  let bestValue = -Infinity;
  for (const move of legalMoves(onTurn, colour)) {
    const value = evaluate(played(onTurn, colour, move), viewpoint);
    if (value > bestValue) {
      bestValue = value;
      best = [move];
    } else if (value === bestValue) best.push(move);
  }
  return best.length === 0 ? undefined : best[rng.int(0, best.length - 1)];
}

/**
 * The bot worker's entry point: `colour`'s move in `position` within `budget`, or undefined when
 * the game has ended or the colour is out. Deterministic for a given seed (a number) or rng, as
 * long as a time budget does not run out. If `colour` is not on turn, it answers as if it were.
 * For a shared colour (side 0), `viewpoint` is a colour of the seat that plays it this turn; the
 * move is then chosen for that seat's side.
 */
export function chooseMove(
  position: Position,
  colour: number,
  budget: Budget,
  rng: Rng | number,
  bot: Bot<Position, Move> = devicePlayer,
  viewpoint?: number,
): Placement | undefined {
  if (position.ended || !position.colours.includes(colour) || position.out.includes(colour)) return undefined;
  const random = typeof rng === "number" ? createRng(rng) : rng;
  const shared = viewpoint !== undefined && viewpoint !== colour && sideOf(position, colour) === 0;
  const move = shared ? sharedMove(position, colour, viewpoint, random) : bot.choose(withTurn(position, colour), budget, random);
  return move === undefined ? undefined : decodeMove(move, position.config.size);
}
