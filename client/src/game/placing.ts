import { chooseMove } from "@palikka/bots";
import { checkPlacement, decodeMove, legalMoves, ORIENTATIONS, type MoveRefusal, type Placement, type Position } from "@palikka/rules";

/**
 * The placement model of the piece controls: the chosen piece and orientation, the pointed square,
 * and the preview it makes on the board. Pure; `usePlacement` holds the state.
 */

/** What the player is placing: a piece, its orientation and the board square pointed at. */
export interface Aim {
  piece: number;
  orientation: number;
  /** Board index the preview is aimed at. */
  square: number;
  /** From a pointer: snap to a legal spot covering the square. Keyboard and hint: exactly there. */
  snap: boolean;
}

export interface Preview {
  move: Placement;
  /** Board indexes the piece covers. */
  squares: number[];
  legal: boolean;
  /** The rules' refusal reason when not legal. */
  reason?: MoveRefusal;
}

/** The squares a move covers, as board indexes. */
export function squaresOf(move: Placement, size: number): number[] {
  return ORIENTATIONS[move.piece]![move.orientation]!.cells.map(([r, c]) => (move.row + r) * size + move.col + c);
}

/**
 * The reference square of an orientation: its cell nearest the centre of its bounding box (ties:
 * first in row-major order). It is what sits under the pointer and what the arrow keys move.
 */
export function referenceCell(piece: number, orientation: number): readonly [row: number, col: number] {
  const { cells, height, width } = ORIENTATIONS[piece]![orientation]!;
  const cr = (height - 1) / 2;
  const cc = (width - 1) / 2;
  let best = cells[0]!;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const d = (cell[0] - cr) ** 2 + (cell[1] - cc) ** 2;
    if (d < bestDistance) {
      best = cell;
      bestDistance = d;
    }
  }
  return best;
}

/** Legal moves per position and colour, grouped by piece and orientation (`piece * 8 + orientation`). */
const grouped = new WeakMap<Position, Map<number, Map<number, Placement[]>>>();

/** The colour's legal moves of one piece in one orientation, in the engine's order. */
export function legalMovesOf(position: Position, colour: number, piece: number, orientation: number): Placement[] {
  let byColour = grouped.get(position);
  if (!byColour) grouped.set(position, (byColour = new Map()));
  let groups = byColour.get(colour);
  if (!groups) {
    groups = new Map();
    for (const code of legalMoves(position, colour)) {
      const move = decodeMove(code, position.config.size);
      const key = move.piece * 8 + move.orientation;
      const list = groups.get(key);
      if (list) list.push(move);
      else groups.set(key, [move]);
    }
    byColour.set(colour, groups);
  }
  return groups.get(piece * 8 + orientation) ?? [];
}

/** The move with the aim's reference square on `square`, shifted inside the board. */
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
 * The preview an aim makes. Snapping: among the legal moves of the piece and orientation that cover
 * the square, the one whose reference square is nearest to it (ties: engine order); with none, the
 * exact spot, marked illegal with the rules' reason. Exact: the reference square on the square.
 */
export function previewAt(position: Position, colour: number, aim: Aim): Preview {
  const { size } = position.config;
  if (aim.snap) {
    const [rr, rc] = referenceCell(aim.piece, aim.orientation);
    const row = Math.floor(aim.square / size);
    const col = aim.square % size;
    let best: Placement | undefined;
    let bestDistance = Infinity;
    for (const move of legalMovesOf(position, colour, aim.piece, aim.orientation)) {
      if (!squaresOf(move, size).includes(aim.square)) continue;
      const d = (move.row + rr - row) ** 2 + (move.col + rc - col) ** 2;
      if (d < bestDistance) {
        best = move;
        bestDistance = d;
      }
    }
    if (best) return { move: best, squares: squaresOf(best, size), legal: true };
  }
  const move = exactMove(aim, size);
  const reason = checkPlacement(position, colour, move);
  return { move, squares: squaresOf(move, size), legal: reason === undefined, ...(reason && { reason }) };
}

/** The board square under a move's reference square: the aim that shows exactly this move. */
export function aimOf(move: Placement, size: number): Aim {
  const [rr, rc] = referenceCell(move.piece, move.orientation);
  return { piece: move.piece, orientation: move.orientation, square: (move.row + rr) * size + move.col + rc, snap: false };
}

/** Time the hint may take on the UI thread. */
const HINT_BUDGET = { timeMs: 100 };

/** "Vihje": the bot's move for `colour` now; seeded by the turn, so it stays the same within a turn. */
export function hintMove(position: Position, colour: number, turn: number): Placement | undefined {
  return chooseMove(position, colour, HINT_BUDGET, turn);
}
