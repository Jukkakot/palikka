import { chooseMove } from "@palikka/bots";
import { decodeMove, freeCorners, legalMoves, ORIENTATIONS, PIECE_SIZES, type Placement, type Position } from "@palikka/rules";

/**
 * Interim move control (until the piece tray of `basic-ui`): the squares the viewer can tap, each
 * with the move a tap makes. A tappable square is a free corner of the colour (the start square
 * before the first piece) covered by at least one legal move; its move places the largest piece
 * covering it (the first such move in the engine's order).
 */
export function interimMoves(position: Position, colour: number): Map<number, Placement> {
  const { size } = position.config;
  const corners = freeCorners(position, colour);
  const moves = new Map<number, Placement>();
  for (const code of legalMoves(position, colour)) {
    const move = decodeMove(code, size);
    for (const [r, c] of ORIENTATIONS[move.piece]![move.orientation]!.cells) {
      const row = move.row + r;
      const col = move.col + c;
      if (((corners[row]! >>> col) & 1) === 0) continue;
      const index = row * size + col;
      const had = moves.get(index);
      if (!had || PIECE_SIZES[move.piece]! > PIECE_SIZES[had.piece]!) moves.set(index, move);
    }
  }
  return moves;
}

/** The squares a move covers, as board indexes. */
export function squaresOf(move: Placement, size: number): number[] {
  return ORIENTATIONS[move.piece]![move.orientation]!.cells.map(([r, c]) => (move.row + r) * size + move.col + c);
}

/** Time the hint may take on the UI thread. */
const HINT_BUDGET = { timeMs: 100 };

/**
 * "Vihje": the squares the bot would cover for `colour` now. Seeded by the turn, so the hint stays
 * the same within a turn. Empty when the colour has no move.
 */
export function hintSquares(position: Position, colour: number, turn: number): number[] {
  const move = chooseMove(position, colour, HINT_BUDGET, turn);
  return move ? squaresOf(move, position.config.size) : [];
}
