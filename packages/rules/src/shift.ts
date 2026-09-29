import { createBoard, type Board } from "./board.js";
import { BOARD_SIZE, square, squareIndex, type Square } from "./geometry.js";
import type { Rotation, Tile } from "./tile.js";

/**
 * An insertion point: the side the spare enters from and the line index.
 * `N1` pushes column 1 down from the top, `E3` pushes row 3 left from the right.
 */
export const INSERTIONS = ["N1", "N3", "N5", "E1", "E3", "E5", "S1", "S3", "S5", "W1", "W3", "W5"] as const;
export type InsertionId = (typeof INSERTIONS)[number];

export function isInsertionId(value: unknown): value is InsertionId {
  return (INSERTIONS as readonly unknown[]).includes(value);
}

function parse(id: InsertionId): { side: "N" | "E" | "S" | "W"; index: number } {
  if (!isInsertionId(id)) throw new Error(`Not an insertion point: "${String(id)}"`);
  return { side: id[0] as "N" | "E" | "S" | "W", index: Number(id.slice(1)) };
}

/** The squares of the line pushed by `id`, entry square first and exit square last. */
export function insertionLine(id: InsertionId): Square[] {
  const { side, index } = parse(id);
  const steps = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  switch (side) {
    case "N":
      return steps.map((i) => square(i, index));
    case "S":
      return steps.map((i) => square(BOARD_SIZE - 1 - i, index));
    case "W":
      return steps.map((i) => square(index, i));
    case "E":
      return steps.map((i) => square(index, BOARD_SIZE - 1 - i));
  }
}

const OPPOSITE_SIDE = { N: "S", S: "N", E: "W", W: "E" } as const;

/** The insertion that would push the same line straight back: N1 ↔ S1, E3 ↔ W3. */
export function reverseOf(id: InsertionId): InsertionId {
  const { side, index } = parse(id);
  return `${OPPOSITE_SIDE[side]}${index}` as InsertionId;
}

export interface ShiftResult {
  readonly board: Board;
  /** The pawn squares after the shift, in the order given. */
  readonly pawns: readonly Square[];
  /** The tile pushed off the board; it is the new board's spare. */
  readonly pushedOut: Tile;
}

/**
 * Inserts the spare at `id` with `rotation`. Every tile of the line moves one
 * square away from the entry; the tile pushed off the far end becomes the new
 * spare with its rotation unchanged. Pawns on the line ride along, and a pawn
 * pushed off the board lands on the inserted tile. Pure: says only what a shift
 * does, not whether it is allowed.
 */
export function shiftBoard(board: Board, id: InsertionId, rotation: Rotation, pawns: readonly Square[] = []): ShiftResult {
  const line = insertionLine(id);
  const indices = line.map(squareIndex);
  const squares = [...board.squares];
  const pushedOut = board.squares[indices[indices.length - 1]!]!;
  for (let i = indices.length - 1; i > 0; i--) squares[indices[i]!] = board.squares[indices[i - 1]!]!;
  squares[indices[0]!] = { ...board.spare, rotation };

  const moved = pawns.map((pawn) => {
    const at = line.findIndex((sq) => sq.row === pawn.row && sq.col === pawn.col);
    if (at === -1) return pawn;
    return at === line.length - 1 ? line[0]! : line[at + 1]!;
  });

  const next = createBoard({ squares, spare: pushedOut });
  return { board: next, pawns: moved, pushedOut: next.spare };
}
