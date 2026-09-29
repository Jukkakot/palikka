import {
  ALL_SQUARES,
  BOARD_SIZE,
  DIRECTIONS,
  directionTo,
  neighbour,
  opposite,
  square,
  squareIndex,
  type Square,
} from "./geometry.js";
import { isOpen, ROTATIONS, TILE_KINDS, type Tile } from "./tile.js";

const SQUARE_COUNT = BOARD_SIZE * BOARD_SIZE;

/** An immutable board: one tile per square (row-major) plus the spare tile. Plain data. */
export interface Board {
  readonly squares: readonly Tile[];
  readonly spare: Tile;
}

/** Input to `createBoard`: same shape as a board, e.g. restored from JSON. */
export interface BoardLayout {
  readonly squares: readonly Tile[];
  readonly spare: Tile;
}

function validateTile(tile: unknown, where: string): Tile {
  const t = tile as Partial<Tile> | null | undefined;
  if (!t || typeof t !== "object") throw new Error(`Missing tile at ${where}`);
  if (!Number.isInteger(t.id)) throw new Error(`Tile at ${where} has an invalid id`);
  if (!TILE_KINDS.includes(t.kind!)) throw new Error(`Tile ${t.id} has an invalid kind "${String(t.kind)}"`);
  if (!ROTATIONS.includes(t.rotation!)) throw new Error(`Tile ${t.id} has an invalid rotation ${String(t.rotation)}`);
  return Object.freeze({ id: t.id!, kind: t.kind!, rotation: t.rotation! });
}

/**
 * Builds a board from an explicit layout. Rejects a layout without exactly 49
 * squares and a spare tile, with invalid tiles, or with duplicate tile ids.
 */
export function createBoard(layout: BoardLayout): Board {
  if (!Array.isArray(layout.squares) || layout.squares.length !== SQUARE_COUNT) {
    throw new Error(`A board needs ${SQUARE_COUNT} squares, got ${layout.squares?.length ?? 0}`);
  }
  const squares = layout.squares.map((tile, i) => validateTile(tile, `square ${i}`));
  const spare = validateTile(layout.spare, "spare");

  const seen = new Set<number>();
  for (const tile of [...squares, spare]) {
    if (seen.has(tile.id)) throw new Error(`Duplicate tile id ${tile.id}`);
    seen.add(tile.id);
  }
  return Object.freeze({ squares: Object.freeze(squares), spare });
}

export function tileAt(board: Board, sq: Square): Tile {
  return board.squares[squareIndex(square(sq.row, sq.col))]!;
}

/** Squares with an even row and an even column hold fixed tiles that never move. */
export function isFixed(sq: Square): boolean {
  return sq.row % 2 === 0 && sq.col % 2 === 0;
}

/** The 16 fixed squares, row-major. */
export const FIXED_SQUARES: readonly Square[] = ALL_SQUARES.filter(isFixed);

/** The players' start corners in clockwise order from the top-left. */
export const START_CORNERS: readonly Square[] = [square(0, 0), square(0, BOARD_SIZE - 1), square(BOARD_SIZE - 1, BOARD_SIZE - 1), square(BOARD_SIZE - 1, 0)];

/** Two orthogonal neighbours are connected when each tile is open toward the other. */
export function isConnected(board: Board, a: Square, b: Square): boolean {
  const dir = directionTo(a, b);
  return dir !== undefined && isOpen(tileAt(board, a), dir) && isOpen(tileAt(board, b), opposite(dir));
}

/** The neighbours of `sq` it is connected to. Openings toward the edge lead nowhere. */
export function connectedNeighbours(board: Board, sq: Square): Square[] {
  return DIRECTIONS.flatMap((dir) => {
    const n = neighbour(sq, dir);
    return n && isConnected(board, sq, n) ? [n] : [];
  });
}
