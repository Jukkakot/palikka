import { decodeMove, emptyBits, forbiddenSquares, freeCorners, ORIENTATIONS, PIECE_SIZES, rowMask, type Bits, type Move, type Position } from "@palikka/rules";
import { popcount } from "./evaluation.js";

/** Hand-set weights of the cheap move key (search ordering; units: one square placed). */
export const KEY_WEIGHTS = {
  /** Per square of the piece. */
  size: 1,
  /** Per opponent free corner square the piece covers. */
  blocks: 1.5,
  /** Per new own corner square the piece opens (approximate: no check that it is really usable). */
  corners: 0.5,
} as const;

interface KeyBoard {
  /** Free corner squares of the colour's opponents still in. */
  readonly opponentCorners: Bits;
  /** Squares the colour may not cover. */
  readonly blocked: Bits;
}

const boards = new WeakMap<Position, Map<number, KeyBoard>>();

function keyBoard(position: Position, colour: number): KeyBoard {
  let perColour = boards.get(position);
  if (!perColour) boards.set(position, (perColour = new Map()));
  const cached = perColour.get(colour);
  if (cached) return cached;
  const opponentCorners = emptyBits(position.config.size);
  for (const c of position.colours) {
    if (c === colour || position.out.includes(c)) continue;
    const corners = freeCorners(position, c);
    for (let r = 0; r < corners.length; r++) opponentCorners[r]! |= corners[r]!;
  }
  const board = { opponentCorners, blocked: forbiddenSquares(position, colour) };
  perColour.set(colour, board);
  return board;
}

/**
 * How promising a legal move of `colour` looks, without playing it: its size, the opponents' free
 * corners it covers, and the new corners it opens for `colour`. Bit operations on boards cached per
 * position and colour, so ranking all of a position's moves costs little more than listing them.
 */
export function moveKey(position: Position, colour: number, move: Move): number {
  const { size } = position.config;
  const { piece, orientation, row, col } = decodeMove(move, size);
  const shape = ORIENTATIONS[piece]![orientation]!;
  const { opponentCorners, blocked } = keyBoard(position, colour);
  const mask = rowMask(size);
  // Piece rows on the board, with a free row above and below: p[i + 1] is board row row + i.
  const h = shape.rows.length;
  const p = new Array<number>(h + 4).fill(0);
  let covered = 0;
  for (let i = 0; i < h; i++) {
    const bits = shape.rows[i]! << col;
    p[i + 2] = bits;
    covered += popcount(bits & opponentCorners[row + i]!);
  }
  let opened = 0;
  for (let i = 1; i < h + 3; i++) {
    const r = row + i - 2;
    if (r < 0 || r >= size) continue;
    const vertical = p[i - 1]! | p[i + 1]!;
    const diagonal = (vertical << 1) | (vertical >>> 1);
    const edge = vertical | (p[i]! << 1) | (p[i]! >>> 1) | p[i]!;
    opened += popcount(diagonal & ~edge & ~blocked[r]! & mask);
  }
  return KEY_WEIGHTS.size * PIECE_SIZES[piece]! + KEY_WEIGHTS.blocks * covered + KEY_WEIGHTS.corners * opened;
}
