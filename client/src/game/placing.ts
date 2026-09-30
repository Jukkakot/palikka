import { topMoves } from "@palikka/bots";
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
  /** A drag: snap only to a legal spot whose reference square is at most one square away. */
  near?: boolean;
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

interface Grouped {
  /** All legal moves in the engine's order. */
  all: Placement[];
  /** By piece and orientation (`piece * 8 + orientation`). */
  groups: Map<number, Placement[]>;
}

/** Legal moves per position and colour, listed once. */
const grouped = new WeakMap<Position, Map<number, Grouped>>();

function groupedOf(position: Position, colour: number): Grouped {
  let byColour = grouped.get(position);
  if (!byColour) grouped.set(position, (byColour = new Map()));
  let entry = byColour.get(colour);
  if (!entry) {
    entry = { all: [], groups: new Map() };
    for (const code of legalMoves(position, colour)) {
      const move = decodeMove(code, position.config.size);
      entry.all.push(move);
      const key = move.piece * 8 + move.orientation;
      const list = entry.groups.get(key);
      if (list) list.push(move);
      else entry.groups.set(key, [move]);
    }
    byColour.set(colour, entry);
  }
  return entry;
}

/** The colour's legal moves of one piece in one orientation, in the engine's order. */
export function legalMovesOf(position: Position, colour: number, piece: number, orientation: number): Placement[] {
  return groupedOf(position, colour).groups.get(piece * 8 + orientation) ?? [];
}

/** The colour's legal moves that cover `square` (of `piece` only, when given), in the engine's order. */
export function movesCovering(position: Position, colour: number, square: number, piece?: number): Placement[] {
  const { size } = position.config;
  return groupedOf(position, colour).all.filter((m) => (piece === undefined || m.piece === piece) && squaresOf(m, size).includes(square));
}

/** The pieces with a legal move covering `square`: the corner mode's tray. */
export function piecesCovering(position: Position, colour: number, square: number): Set<number> {
  return new Set(movesCovering(position, colour, square).map((m) => m.piece));
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
 * exact spot, marked illegal with the rules' reason. Near (a drag): among the legal moves whose
 * reference square is at most one square from it (diagonals too), the nearest; with none, the exact
 * spot. Exact: the reference square on the square.
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
      const near = Math.max(Math.abs(move.row + rr - row), Math.abs(move.col + rc - col)) <= 1;
      if (aim.near ? !near : !squaresOf(move, size).includes(aim.square)) continue;
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

/** How many moves "Vihje" steps through. */
export const HINT_COUNT = 3;

/**
 * "Vihje": the bot's best moves for `colour` now, best first (at most `HINT_COUNT`), one ply deep;
 * seeded by the turn, so they stay the same within a turn. For the shared colour, `viewpoint` is
 * one of the viewer's own colours: the moves are chosen for them.
 */
export function hintMoves(position: Position, colour: number, turn: number, viewpoint?: number): Placement[] {
  return topMoves(position, colour, HINT_COUNT, turn, viewpoint);
}
