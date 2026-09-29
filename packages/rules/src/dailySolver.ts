import { connectedNeighbours, tileAt, type Board } from "./board.js";
import { ALL_SQUARES, squareIndex, type Square } from "./geometry.js";
import { INSERTIONS, reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { openings, ROTATIONS, rotate, type Rotation } from "./tile.js";
import { treasureOf, type TreasureId } from "./tileSet.js";

/** One node of the search: a board after some shifts and every square the pawn could stand on. */
interface Node {
  board: Board;
  squares: Square[];
  last: InsertionId | undefined;
}

/** The spare's rotations that give different tiles (a straight has two, a corner or tee four). */
function distinctRotations(board: Board): Rotation[] {
  const seen = new Set<string>();
  return ROTATIONS.filter((r) => {
    const key = openings(rotate({ ...board.spare, rotation: 0 }, r / 90)).join();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every square connected to any of `from` (a multi-source flood). */
function reachFrom(board: Board, from: readonly Square[]): Square[] {
  const seen = new Uint8Array(ALL_SQUARES.length);
  const queue: Square[] = [];
  for (const sq of from) {
    const i = squareIndex(sq);
    if (seen[i]) continue;
    seen[i] = 1;
    queue.push(sq);
  }
  for (let q = 0; q < queue.length; q++) {
    for (const next of connectedNeighbours(board, queue[q]!)) {
      const n = squareIndex(next);
      if (seen[n]) continue;
      seen[n] = 1;
      queue.push(next);
    }
  }
  return queue;
}

/**
 * The fewest turns (a shift and a move each) in which a pawn on `start` can end its move on each
 * treasure, searching every shift and rotation up to `maxTurns` turns; treasures not reachable
 * within that are left out. The pawn's own choices never change the board, so each board keeps the
 * set of squares the pawn could be on instead of one node per square.
 */
export function fewestTurns(board: Board, start: Square, maxTurns: number, lastInsertion?: InsertionId): Map<TreasureId, number> {
  const best = new Map<TreasureId, number>();
  let frontier: Node[] = [{ board, squares: [start], last: lastInsertion }];
  for (let turn = 1; turn <= maxTurns && frontier.length > 0; turn++) {
    const next: Node[] = [];
    for (const node of frontier) {
      const forbidden = node.last && reverseOf(node.last);
      const rotations = distinctRotations(node.board);
      for (const insertion of INSERTIONS) {
        if (insertion === forbidden) continue;
        for (const rotation of rotations) {
          const shifted = shiftBoard(node.board, insertion, rotation, node.squares);
          const reach = reachFrom(shifted.board, shifted.pawns);
          for (const sq of reach) {
            const treasure = treasureOf(tileAt(shifted.board, sq).id);
            if (treasure && !best.has(treasure)) best.set(treasure, turn);
          }
          if (turn < maxTurns) next.push({ board: shifted.board, squares: reach, last: insertion });
        }
      }
    }
    frontier = next;
  }
  return best;
}

/** One turn of a route: the shift, and the square walked to after it. */
export interface PuzzleStep {
  insertion: InsertionId;
  rotation: Rotation;
  to: Square;
}

type Shift = Pick<PuzzleStep, "insertion" | "rotation">;

const holds = (board: Board, sq: Square, target: TreasureId) => treasureOf(tileAt(board, sq).id) === target;

/**
 * The shortest sequence of shifts after which a pawn on any of `squares` can walk onto `target`'s
 * tile (the same set search as `fewestTurns`, keeping each node's shifts); undefined if none within
 * `maxTurns`.
 */
export function findShifts(board: Board, squares: readonly Square[], target: TreasureId, maxTurns: number, lastInsertion?: InsertionId): Shift[] | undefined {
  let frontier: (Node & { path: Shift[] })[] = [{ board, squares: [...squares], last: lastInsertion, path: [] }];
  for (let turn = 1; turn <= maxTurns && frontier.length > 0; turn++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const forbidden = node.last && reverseOf(node.last);
      for (const insertion of INSERTIONS) {
        if (insertion === forbidden) continue;
        for (const rotation of distinctRotations(node.board)) {
          const shifted = shiftBoard(node.board, insertion, rotation, node.squares);
          const reach = reachFrom(shifted.board, shifted.pawns);
          const path = [...node.path, { insertion, rotation }];
          if (reach.some((sq) => holds(shifted.board, sq, target))) return path;
          if (turn < maxTurns) next.push({ board: shifted.board, squares: reach, last: insertion, path });
        }
      }
    }
    frontier = next;
  }
  return undefined;
}

/** Whether a pawn on any of `squares` can walk onto `target` after the given `shifts` in order. */
function followsThrough(board: Board, squares: readonly Square[], shifts: readonly Shift[], target: TreasureId): boolean {
  let current = { board, squares: [...squares] };
  for (const { insertion, rotation } of shifts) {
    const shifted = shiftBoard(current.board, insertion, rotation, current.squares);
    current = { board: shifted.board, squares: reachFrom(shifted.board, shifted.pawns) };
  }
  return current.squares.some((sq) => holds(current.board, sq, target));
}

/**
 * On a move step: the square among `reach` to walk to that keeps the fewest turns to `target` (the
 * target's own square when it is in reach); undefined if the target is more than `maxTurns` away.
 */
export function bestMove(board: Board, reach: readonly Square[], target: TreasureId, lastInsertion: InsertionId | undefined, maxTurns: number): Square | undefined {
  const here = reach.find((sq) => holds(board, sq, target));
  if (here) return here;
  const shifts = findShifts(board, reach, target, maxTurns, lastInsertion);
  return shifts && reach.find((sq) => followsThrough(board, [sq], shifts, target));
}

/**
 * On a shift step: a route to `target` in the fewest turns for a pawn on `pawn`, each step's shift
 * and walk; undefined if it needs more than `maxTurns`.
 */
export function bestLine(board: Board, pawn: Square, target: TreasureId, lastInsertion: InsertionId | undefined, maxTurns: number): PuzzleStep[] | undefined {
  const shifts = findShifts(board, [pawn], target, maxTurns, lastInsertion);
  if (!shifts) return undefined;
  const steps: PuzzleStep[] = [];
  let at = { board, pawn };
  shifts.forEach((shift, i) => {
    const shifted = shiftBoard(at.board, shift.insertion, shift.rotation, [at.pawn]);
    const reach = reachFrom(shifted.board, shifted.pawns);
    const rest = shifts.slice(i + 1);
    // The last walk ends on the target; earlier ones on a square the remaining shifts still lead on from.
    const to = reach.find((sq) => (rest.length === 0 ? holds(shifted.board, sq, target) : followsThrough(shifted.board, [sq], rest, target)))!;
    steps.push({ ...shift, to });
    at = { board: shifted.board, pawn: to };
  });
  return steps;
}
