import { MONOMINO, PIECE_COUNT, PIECE_SIZES, SET_SQUARES } from "./pieces.js";
import type { Position } from "./position.js";

/** Bonus for placing every piece. */
export const ALL_PLACED_BONUS = 15;
/** Extra bonus when the single square was the last piece placed. */
export const MONOMINO_LAST_BONUS = 5;

export interface ColourScore {
  readonly colour: number;
  readonly score: number;
  /** Squares the colour has on the board. */
  readonly squares: number;
}

export function scoreOf(pieces: readonly number[]): number {
  const onBoard = pieces.reduce((sum, piece) => sum + PIECE_SIZES[piece]!, 0);
  if (pieces.length < PIECE_COUNT) return onBoard - SET_SQUARES;
  return ALL_PLACED_BONUS + (pieces.at(-1) === MONOMINO ? MONOMINO_LAST_BONUS : 0);
}

/** Score and squares on board per colour, in colour order. */
export function scores(position: Position): ColourScore[] {
  return position.colours.map((colour) => {
    const pieces = position.placed[colour] ?? [];
    return {
      colour,
      score: scoreOf(pieces),
      squares: pieces.reduce((sum, piece) => sum + PIECE_SIZES[piece]!, 0),
    };
  });
}

/** The colours with the highest score once the game has ended; none while running or when aborted. */
export function winners(position: Position): number[] {
  if (!position.ended || position.aborted) return [];
  const all = scores(position);
  const best = Math.max(...all.map((s) => s.score));
  return all.filter((s) => s.score === best).map((s) => s.colour);
}
