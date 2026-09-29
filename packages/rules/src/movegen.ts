import { diagonalNeighbours, edgeNeighbours, emptyBits, rowMask, type Bits } from "./bitboard.js";
import type { Move } from "./moves.js";
import { MAX_ORIENTATIONS, ORIENTATIONS, PIECE_COUNT } from "./pieces.js";
import { bitView, type Position } from "./position.js";

/**
 * Fast legal move generation, corner-based: every legal placement (after the first) covers one of
 * the colour's free corner squares, so each corner × unplaced orientation × orientation cell fixes
 * one candidate position; a candidate is legal iff it is on the board and misses `forbidden`.
 */

/** Squares the colour may not cover: occupied, or edge-adjacent to its own squares. */
function forbiddenFor(position: Position, colour: number): Bits {
  const { size } = position.config;
  const view = bitView(position);
  const forbidden = edgeNeighbours(view.own[colour]!, size);
  for (let r = 0; r < size; r++) forbidden[r] = forbidden[r]! | view.occupied[r]!;
  return forbidden;
}

/** Free squares where the colour's next piece must touch down (the start square at first). */
function cornersFor(position: Position, colour: number, forbidden: Bits): Bits {
  const { size, starts } = position.config;
  if ((position.placed[colour] ?? []).length === 0) {
    const corners = emptyBits(size);
    const start = starts[colour]!;
    if (((forbidden[start.row]! >>> start.col) & 1) === 0) corners[start.row] = 1 << start.col;
    return corners;
  }
  const corners = diagonalNeighbours(bitView(position).own[colour]!, size);
  const mask = rowMask(size);
  for (let r = 0; r < size; r++) corners[r] = corners[r]! & ~forbidden[r]! & mask;
  return corners;
}

/** Calls `visit` for each candidate that fits; stops when it returns true. */
function forEachFit(position: Position, colour: number, visit: (code: Move) => boolean | void): void {
  if (!position.colours.includes(colour)) return;
  const { size } = position.config;
  const used = bitView(position).used[colour]!;
  const forbidden = forbiddenFor(position, colour);
  const corners = cornersFor(position, colour, forbidden);
  for (let r = 0; r < size; r++) {
    let word = corners[r]!;
    while (word !== 0) {
      const low = word & -word;
      const c = 31 - Math.clz32(low);
      word = (word ^ low) >>> 0;
      for (let piece = 0; piece < PIECE_COUNT; piece++) {
        if (used[piece]) continue;
        const orientations = ORIENTATIONS[piece]!;
        for (let o = 0; o < orientations.length; o++) {
          const { cells, rows, height, width } = orientations[o]!;
          for (let k = 0; k < cells.length; k++) {
            const top = r - cells[k]![0];
            const left = c - cells[k]![1];
            if (top < 0 || left < 0 || top + height > size || left + width > size) continue;
            let fits = true;
            for (let i = 0; i < height; i++) {
              if (((rows[i]! << left) & forbidden[top + i]!) !== 0) {
                fits = false;
                break;
              }
            }
            if (fits && visit(((piece * MAX_ORIENTATIONS + o) * size + top) * size + left) === true) return;
          }
        }
      }
    }
  }
}

/** Per-call duplicate filter: a stamp per move code, reused between calls. */
let seen = new Uint32Array(0);
let stamp = 0;

/**
 * Every legal move of `colour` in `position`, each once, in a deterministic order (corners
 * row-major, then pieces, orientations and orientation cells by index). Ignores whose turn it is.
 */
export function legalMoves(position: Position, colour: number): Move[] {
  const { size } = position.config;
  const codes = PIECE_COUNT * MAX_ORIENTATIONS * size * size;
  if (seen.length < codes) seen = new Uint32Array(codes);
  stamp = (stamp + 1) >>> 0;
  if (stamp === 0) {
    seen.fill(0);
    stamp = 1;
  }
  const moves: Move[] = [];
  const mark = stamp;
  forEachFit(position, colour, (code) => {
    if (seen[code] !== mark) {
      seen[code] = mark;
      moves.push(code);
    }
  });
  return moves;
}

/** The pieces of `colour` with at least one legal move. */
export function fittingPieces(position: Position, colour: number): Set<number> {
  const pieces = new Set<number>();
  forEachFit(position, colour, (code) => {
    pieces.add(Math.floor(code / (MAX_ORIENTATIONS * position.config.size * position.config.size)));
  });
  return pieces;
}

/** Whether `colour` has any legal move; stops at the first one. */
export function hasLegalMove(position: Position, colour: number): boolean {
  let found = false;
  forEachFit(position, colour, () => (found = true));
  return found;
}

/** Squares `colour` may not cover: occupied, or sharing an edge with its own squares. A new copy. */
export function forbiddenSquares(position: Position, colour: number): Bits {
  if (!position.colours.includes(colour)) return emptyBits(position.config.size);
  return forbiddenFor(position, colour);
}

/**
 * The colour's free corner squares: where its next piece may touch down (its start square before
 * the first piece, while free). Empty for a colour not in the game. A new copy.
 */
export function freeCorners(position: Position, colour: number): Bits {
  if (!position.colours.includes(colour)) return emptyBits(position.config.size);
  return cornersFor(position, colour, forbiddenFor(position, colour));
}
