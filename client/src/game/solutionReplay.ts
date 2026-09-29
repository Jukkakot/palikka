import { bestLine, shiftBoard, shortestPath, startDailyPuzzle, targetOf, TILE_SET, type Board, type InsertionId, type Square } from "@labyrinth/rules";

/** One step of the best route's replay: what the board shows then. */
export interface ReplayFrame {
  step: "start" | "shift" | "move";
  /** The turn the step belongs to; 0 for the start. */
  turn: number;
  board: Board;
  pawn: Square;
  /** The shift of this turn (marked at the board edge). */
  insertion?: InsertionId;
  /** The walk of this turn, `[from, …, to]`. */
  route?: Square[];
  /** The destination's tile. */
  targetTileId: number;
}

/**
 * A best route of the puzzle of `date` from its start, as frames: the start, then per turn the
 * shift (pawn carried along) and the walk. Rebuilt from the date, so nothing needs saving.
 */
export function solutionFrames(date: string, name: string): ReplayFrame[] {
  const { game, par } = startDailyPuzzle(date, name);
  const seat = game.seats[0]!;
  const target = targetOf(seat)!;
  const targetTileId = TILE_SET.find((t) => t.treasure === target)!.id;
  const frames: ReplayFrame[] = [{ step: "start", turn: 0, board: game.board, pawn: seat.pawn, targetTileId }];
  let board = game.board;
  let pawn = seat.pawn;
  (bestLine(board, pawn, target, undefined, par) ?? []).forEach((step, i) => {
    const shifted = shiftBoard(board, step.insertion, step.rotation, [pawn]);
    board = shifted.board;
    const carried = shifted.pawns[0]!;
    frames.push({ step: "shift", turn: i + 1, board, pawn: carried, insertion: step.insertion, targetTileId });
    const route = shortestPath(board, carried, step.to) ?? [carried, step.to];
    pawn = step.to;
    frames.push({ step: "move", turn: i + 1, board, pawn, insertion: step.insertion, route: route.length > 1 ? route : undefined, targetTileId });
  });
  return frames;
}
