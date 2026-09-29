import { connectedNeighbours, type Board } from "./board.js";
import { ALL_SQUARES, sameSquare, squareIndex, type Square } from "./geometry.js";

/**
 * Breadth-first search over connected corridors from `from`. Returns the parent
 * index of every visited square (the start points to itself), -1 elsewhere.
 * Pawns never block: the rules ignore them.
 */
function explore(board: Board, from: Square): number[] {
  const parent: number[] = ALL_SQUARES.map(() => -1);
  const start = squareIndex(from);
  parent[start] = start;
  const queue: Square[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const sq = queue[i]!;
    for (const next of connectedNeighbours(board, sq)) {
      const n = squareIndex(next);
      if (parent[n] !== -1) continue;
      parent[n] = squareIndex(sq);
      queue.push(next);
    }
  }
  return parent;
}

/** Every square a pawn on `from` can reach, `from` itself first, the rest row-major. */
export function reachableSquares(board: Board, from: Square): Square[] {
  const parent = explore(board, from);
  const found = ALL_SQUARES.filter((sq) => parent[squareIndex(sq)] !== -1);
  return [from, ...found.filter((sq) => !sameSquare(sq, from))];
}

export function isReachable(board: Board, from: Square, to: Square): boolean {
  return explore(board, from)[squareIndex(to)] !== -1;
}

/** A shortest walk `[from, …, to]` through connected squares, or undefined if `to` is unreachable. */
export function shortestPath(board: Board, from: Square, to: Square): Square[] | undefined {
  const parent = explore(board, from);
  let at = squareIndex(to);
  if (parent[at] === -1) return undefined;
  const path: Square[] = [ALL_SQUARES[at]!];
  while (parent[at] !== at) {
    at = parent[at]!;
    path.push(ALL_SQUARES[at]!);
  }
  return path.reverse();
}
