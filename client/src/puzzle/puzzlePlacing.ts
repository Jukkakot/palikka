import { ORIENTATIONS, puzzleFits, puzzleSquares, type Placement, type Puzzle, type PuzzleRefusal } from "@palikka/rules";
import { referenceCell, type Aim } from "../game/placing.ts";

/**
 * The placement model of the daily puzzle: the same aiming as in a game (`placing.ts`: reference
 * square, a pointer snaps, the keyboard aims exactly), under the puzzle rule (a piece fits on empty
 * squares of the shape). Pure; `usePuzzle` holds the state.
 */

export interface PuzzlePreview {
  move: Placement;
  squares: number[];
  legal: boolean;
  reason?: PuzzleRefusal;
}

/** The move with the aim's reference square on the aimed square, shifted inside the board. */
function exactMove(aim: Aim, size: number): Placement {
  const { height, width } = ORIENTATIONS[aim.piece]![aim.orientation]!;
  const [rr, rc] = referenceCell(aim.piece, aim.orientation);
  const row = Math.floor(aim.square / size) - rr;
  const col = (aim.square % size) - rc;
  return {
    piece: aim.piece,
    orientation: aim.orientation,
    row: Math.min(Math.max(row, 0), size - height),
    col: Math.min(Math.max(col, 0), size - width),
  };
}

/**
 * The preview an aim makes. Snapping: among the fitting spots of the orientation that cover the
 * square, the one whose reference square is nearest; with none, the exact spot with the refusal.
 */
export function puzzlePreviewAt(puzzle: Puzzle, placements: readonly Placement[], aim: Aim): PuzzlePreview {
  const { size } = puzzle;
  if (aim.snap) {
    const { height, width, cells } = ORIENTATIONS[aim.piece]![aim.orientation]!;
    const [rr, rc] = referenceCell(aim.piece, aim.orientation);
    const row = Math.floor(aim.square / size);
    const col = aim.square % size;
    let best: Placement | undefined;
    let bestDistance = Infinity;
    // Only spots that cover the square: the square minus one of the piece's cells.
    for (const [cr, cc] of cells) {
      const move = { piece: aim.piece, orientation: aim.orientation, row: row - cr, col: col - cc };
      if (move.row < 0 || move.col < 0 || move.row + height > size || move.col + width > size) continue;
      if (puzzleFits(puzzle, placements, move)) continue;
      const d = (move.row + rr - row) ** 2 + (move.col + rc - col) ** 2;
      if (d < bestDistance) {
        best = move;
        bestDistance = d;
      }
    }
    if (best) return { move: best, squares: puzzleSquares(puzzle, best), legal: true };
  }
  const move = exactMove(aim, size);
  const reason = puzzleFits(puzzle, placements, move);
  return { move, squares: puzzleSquares(puzzle, move), legal: reason === undefined, ...(reason && { reason }) };
}

/** The placed piece covering `square`, if any. */
export function placementAt(puzzle: Puzzle, placements: readonly Placement[], square: number): Placement | undefined {
  return placements.find((p) => puzzleSquares(puzzle, p).includes(square));
}

/**
 * Owner colour per board square (0 = empty): each placed piece, in placement order, takes the lowest
 * of the four seat colours no edge-neighbouring piece has, so neighbours differ.
 */
export function puzzleColours(puzzle: Puzzle, placements: readonly Placement[]): number[] {
  const { size } = puzzle;
  const owner = new Array<number>(size * size).fill(0);
  for (const move of placements) {
    const squares = puzzleSquares(puzzle, move);
    const taken = new Set<number>();
    for (const i of squares) {
      const r = Math.floor(i / size);
      const c = i % size;
      if (r > 0) taken.add(owner[i - size]!);
      if (r < size - 1) taken.add(owner[i + size]!);
      if (c > 0) taken.add(owner[i - 1]!);
      if (c < size - 1) taken.add(owner[i + 1]!);
    }
    const colour = [1, 2, 3, 4].find((c) => !taken.has(c)) ?? 1;
    for (const i of squares) owner[i] = colour;
  }
  return owner;
}
