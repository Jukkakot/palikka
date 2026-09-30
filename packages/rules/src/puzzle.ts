import type { Placement } from "./moves.js";
import { ORIENTATIONS, PIECE_SIZES } from "./pieces.js";
import { createRng, shuffle, type Rng } from "./rng.js";

/**
 * The daily puzzle ("Päivän pulma"): a shape to fill exactly with a given set of pieces. Generated
 * from the date alone, so every device shows the same puzzle on the same day, and solvable by
 * construction (the shape is packed from the pieces).
 */

/** Part of the seed: bump only when the puzzles are meant to change. */
export const PUZZLE_VERSION = 1;

export interface Puzzle {
  /** Local date `YYYY-MM-DD`. */
  readonly date: string;
  /** The board is `size × size`; only the shape's squares belong to the puzzle. */
  readonly size: number;
  /** Board indexes of the shape, ascending. */
  readonly shape: readonly number[];
  /** Piece numbers, ascending, each used once. */
  readonly pieces: readonly number[];
  /** One way to fill the shape. */
  readonly solution: readonly Placement[];
}

export type PuzzleRefusal = "PIECE_USED" | "OFF_SHAPE" | "OVERLAP";

/** Pieces by weekday, Sunday first (`Date.getUTCDay`). */
const PIECES_BY_WEEKDAY = [8, 5, 5, 6, 6, 7, 7] as const;
const PENTOMINOES = PIECE_SIZES.flatMap((size, piece) => (size === 5 ? [piece] : []));
const SMALL = PIECE_SIZES.flatMap((size, piece) => (size === 3 || size === 4 ? [piece] : []));
/** Work grid of the generator; the shape is cropped from it. */
const WORK = 16;
const MAX_ATTEMPTS = 50;

/** FNV-1a, 32 bit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function parseDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : undefined;
  if (!parsed || parsed.toISOString().slice(0, 10) !== date) throw new RangeError(`Not a date: ${date}`);
  return parsed;
}

/** Number of pieces in the puzzle of `date`: 5 on Monday up to 8 on Sunday. */
export function puzzlePieceCount(date: string): number {
  return PIECES_BY_WEEKDAY[parseDate(date).getUTCDay()]!;
}

/** The squares (work-grid indexes) of a placement. */
function squares(p: Placement, size: number): number[] {
  return ORIENTATIONS[p.piece]![p.orientation]!.cells.map(([r, c]) => (p.row + r) * size + p.col + c);
}

const STEPS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** True when some empty square inside the grid cannot reach the grid's border through empty squares. */
function hasHole(filled: Uint8Array, size: number): boolean {
  const seen = new Uint8Array(size * size);
  const stack: number[] = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    if ((r === 0 || c === 0 || r === size - 1 || c === size - 1) && !filled[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const [dr, dc] of STEPS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const n = nr * size + nc;
      if (!filled[n] && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  for (let i = 0; i < size * size; i++) if (!filled[i] && !seen[i]) return true;
  return false;
}

/** Packs the pieces into a compact shape on the work grid; undefined when a piece finds no spot. */
function pack(rng: Rng, pieces: readonly number[]): { filled: Uint8Array; placements: Placement[] } | undefined {
  const filled = new Uint8Array(WORK * WORK);
  const placements: Placement[] = [];
  for (const piece of pieces) {
    const orientations = ORIENTATIONS[piece]!;
    let candidates: Placement[] = [];
    let best = 0;
    if (placements.length === 0) {
      const o = orientations[rng.int(0, orientations.length - 1)]!;
      candidates = [{ piece, orientation: o.index, row: (WORK - o.height) >> 1, col: (WORK - o.width) >> 1 }];
    } else {
      const scored: { move: Placement; contact: number }[] = [];
      for (const o of orientations) {
        for (let row = 0; row + o.height <= WORK; row++) {
          for (let col = 0; col + o.width <= WORK; col++) {
            const move = { piece, orientation: o.index, row, col };
            const cells = squares(move, WORK);
            if (cells.some((i) => filled[i])) continue;
            let contact = 0;
            for (const i of cells) {
              const r = Math.floor(i / WORK);
              const c = i % WORK;
              for (const [dr, dc] of STEPS) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < WORK && nc < WORK && filled[nr * WORK + nc]) contact++;
              }
            }
            if (contact === 0) continue;
            scored.push({ move, contact });
            if (contact > best) best = contact;
          }
        }
      }
      candidates = scored.filter((s) => s.contact >= best - 1).map((s) => s.move);
    }
    if (candidates.length === 0) return undefined;
    const move = candidates[rng.int(0, candidates.length - 1)]!;
    for (const i of squares(move, WORK)) filled[i] = 1;
    placements.push(move);
  }
  return { filled, placements };
}

/** Crops the packing to its bounding box, centred on a square board. */
function crop(date: string, pieces: readonly number[], filled: Uint8Array, placements: readonly Placement[]): Puzzle {
  let top = WORK;
  let left = WORK;
  let bottom = 0;
  let right = 0;
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]) continue;
    const r = Math.floor(i / WORK);
    const c = i % WORK;
    top = Math.min(top, r);
    bottom = Math.max(bottom, r);
    left = Math.min(left, c);
    right = Math.max(right, c);
  }
  const height = bottom - top + 1;
  const width = right - left + 1;
  const size = Math.max(height, width);
  const dr = ((size - height) >> 1) - top;
  const dc = ((size - width) >> 1) - left;
  const solution = placements.map((p) => ({ ...p, row: p.row + dr, col: p.col + dc }));
  const shape = solution.flatMap((p) => squares(p, size)).sort((a, b) => a - b);
  return { date, size, shape, pieces: [...pieces].sort((a, b) => a - b), solution };
}

/** The puzzle of a local date `YYYY-MM-DD`; the same date always gives the same puzzle. */
export function dailyPuzzle(date: string): Puzzle {
  const count = puzzlePieceCount(date);
  const rng = createRng(hash(`palikka-puzzle-${PUZZLE_VERSION}-${date}`));
  const pieces = [...shuffle(rng, PENTOMINOES).slice(0, count - 2), ...shuffle(rng, SMALL).slice(0, 2)];
  let last: ReturnType<typeof pack>;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Larger pieces first pack more compactly; the order is still drawn so shapes vary.
    const order = shuffle(rng, pieces).sort((a, b) => PIECE_SIZES[b]! - PIECE_SIZES[a]!);
    const packed = pack(rng, order);
    if (!packed) continue;
    last = packed;
    if (!hasHole(packed.filled, WORK)) break;
  }
  if (!last) throw new Error(`No packing for ${date}`);
  return crop(date, pieces, last.filled, last.placements);
}

/** Whether `placement` fits on the puzzle with `placements` already on it; the reason when not. */
export function puzzleFits(puzzle: Puzzle, placements: readonly Placement[], placement: Placement): PuzzleRefusal | undefined {
  const { size } = puzzle;
  if (!puzzle.pieces.includes(placement.piece) || placements.some((p) => p.piece === placement.piece)) return "PIECE_USED";
  const orientation = ORIENTATIONS[placement.piece]?.[placement.orientation];
  if (!orientation) return "OFF_SHAPE";
  const shape = new Set(puzzle.shape);
  const covered = new Set(placements.flatMap((p) => squares(p, size)));
  let overlap = false;
  for (const [r, c] of orientation.cells) {
    const row = placement.row + r;
    const col = placement.col + c;
    if (row < 0 || col < 0 || row >= size || col >= size || !shape.has(row * size + col)) return "OFF_SHAPE";
    if (covered.has(row * size + col)) overlap = true;
  }
  return overlap ? "OVERLAP" : undefined;
}

/** Every piece is on the board; the pieces' sizes add up to the shape, so it is covered exactly. */
export function puzzleSolved(puzzle: Puzzle, placements: readonly Placement[]): boolean {
  const placed = new Set(placements.map((p) => p.piece));
  return puzzle.pieces.every((piece) => placed.has(piece));
}

/** Board indexes a placement covers on the puzzle board. */
export function puzzleSquares(puzzle: Pick<Puzzle, "size">, placement: Placement): number[] {
  return squares(placement, puzzle.size);
}
