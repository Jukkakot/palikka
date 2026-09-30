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

export interface SideScore {
  /** The seat that owns the colours (classic: the colour itself). */
  readonly side: number;
  readonly colours: readonly number[];
  readonly score: number;
  readonly squares: number;
}

/** The side a colour scores for; 0 = shared (no one). */
export function sideOf(position: Position, colour: number): number {
  return position.sides[colour] ?? colour;
}

/** Scores summed per side, sides ascending; a shared colour (side 0) is left out. */
export function sideScores(position: Position): SideScore[] {
  const bySide = new Map<number, { colours: number[]; score: number; squares: number }>();
  for (const s of scores(position)) {
    const side = sideOf(position, s.colour);
    if (side === 0) continue;
    const entry = bySide.get(side) ?? { colours: [], score: 0, squares: 0 };
    entry.colours.push(s.colour);
    entry.score += s.score;
    entry.squares += s.squares;
    bySide.set(side, entry);
  }
  return [...bySide.entries()].sort(([a], [b]) => a - b).map(([side, e]) => ({ side, ...e }));
}

/**
 * The sides with the highest score once the game has ended, among those not in `excluded` (sides
 * that left); none while running or when aborted. Classic: sides are colours.
 */
export function winners(position: Position, excluded: readonly number[] = []): number[] {
  if (!position.ended || position.aborted) return [];
  const all = sideScores(position).filter((s) => !excluded.includes(s.side));
  if (all.length === 0) return [];
  const best = Math.max(...all.map((s) => s.score));
  return all.filter((s) => s.score === best).map((s) => s.side);
}
