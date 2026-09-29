import { shortestPath, type Board, type Square } from "@labyrinth/rules";

/** Slide time of a pawn riding a shift; matches the tile slide. */
export const RIDE_MS = 200;
/** A walk takes at most this long, however long the path. */
export const WALK_MAX_MS = 900;
export const STEP_MAX_MS = 120;

export type PawnMotion =
  | { kind: "walk"; path: Square[]; stepMs: number }
  | { kind: "slide"; ms: number }
  | { kind: "jump" };

const distance = (a: Square, b: Square) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * How a pawn gets from `from` to `to` on screen. During a shift it rides its
 * tile one square, or jumps when it wraps around to the inserted tile. Otherwise
 * it walks a shortest corridor path on `board`; with no path (e.g. the state
 * jumped after a reconnect) or reduced motion it jumps.
 */
export function pawnMotion(from: Square, to: Square, board: Board, shifted: boolean, reducedMotion: boolean): PawnMotion {
  if (reducedMotion) return { kind: "jump" };
  if (shifted) return distance(from, to) === 1 ? { kind: "slide", ms: RIDE_MS } : { kind: "jump" };
  const path = shortestPath(board, from, to);
  if (!path || path.length < 2) return { kind: "jump" };
  const steps = path.length - 1;
  return { kind: "walk", path, stepMs: Math.min(STEP_MAX_MS, Math.floor(WALK_MAX_MS / steps)) };
}

export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
