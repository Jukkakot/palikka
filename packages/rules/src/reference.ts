import { legalMoves } from "./movegen.js";
import { encodeMove, type Move } from "./moves.js";
import { ORIENTATIONS, PIECE_COUNT } from "./pieces.js";
import { applyMove } from "./play.js";
import { checkPlacement, type Position } from "./position.js";
import { createRng } from "./rng.js";

/**
 * Naive move generator for tests: every piece × orientation × position on the board through
 * `checkPlacement`. Slow and obviously correct; the fast generator is checked against it.
 */
export function referenceMoves(position: Position, colour: number): Move[] {
  const { size } = position.config;
  const moves: Move[] = [];
  for (let piece = 0; piece < PIECE_COUNT; piece++) {
    ORIENTATIONS[piece]!.forEach(({ height, width }, orientation) => {
      for (let row = 0; row + height <= size; row++) {
        for (let col = 0; col + width <= size; col++) {
          const placement = { piece, orientation, row, col };
          if (checkPlacement(position, colour, placement) === undefined) moves.push(encodeMove(placement, size));
        }
      }
    });
  }
  return moves;
}

/**
 * Plays a game with a uniformly random legal move each turn, from `start` until it ends or
 * `maxMoves` pieces were placed. Returns every position on the way, the start included.
 */
export function randomGame(start: Position, seed: number, maxMoves = Infinity): Position[] {
  const rng = createRng(seed);
  const positions = [start];
  let position = start;
  while (!position.ended && position.moveNumber - start.moveNumber < maxMoves) {
    const moves = legalMoves(position, position.turn);
    const result = applyMove(position, position.turn, moves[rng.int(0, moves.length - 1)]!);
    if (!result.ok) throw new Error(`Random move refused: ${result.code}`);
    position = result.position;
    positions.push(position);
  }
  return positions;
}
