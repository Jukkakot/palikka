import { reachableSquares, sameSquare, setupBoard, shiftBoard, type Board, type InsertionId, type Square } from "@labyrinth/rules";
import { describe, expect, it } from "vitest";
import type { SeatView } from "../session/viewModel.ts";
import { nextTrace } from "./turnTrace.ts";

const seat = (n: number, square: Square): SeatView => ({
  seat: n, sessionId: `s${n}`, name: `P${n}`, connected: true, isMe: n === 1, isBot: n !== 1, square, cards: 5, found: [],
});

interface ViewArgs {
  board: Board;
  squares: Square[];
  turnSeat: number;
  step: "shift" | "move";
  lastInsertion?: InsertionId;
  finished?: boolean;
}

const view = ({ board, squares, turnSeat, step, lastInsertion, finished = false }: ViewArgs) => ({
  board,
  seats: squares.map((sq, i) => seat(i + 1, sq)),
  turnSeat,
  step,
  lastInsertion,
  finished,
});

const corners = [{ row: 0, col: 0 }, { row: 0, col: 6 }];

/** Seat 2 shifts at N3 on its turn; returns the view right after the shift (move step). */
function afterShift() {
  const start = setupBoard(7);
  const shifted = shiftBoard(start, "N3", 0, corners);
  const before = view({ board: start, squares: corners, turnSeat: 2, step: "shift" });
  const after = view({ board: shifted.board, squares: [...shifted.pawns], turnSeat: 2, step: "move", lastInsertion: "N3" });
  return { before, after, board: shifted.board, pawns: [...shifted.pawns] };
}

describe("board-view › Last turn shown", () => {
  it("nothing is marked for a game already under way when first seen", () => {
    const { before } = afterShift();
    const trace = nextTrace(undefined, before);
    expect(trace.insertion).toBeUndefined();
    expect(trace.route).toBeUndefined();
  });

  it("a shift marks where the tile was pushed in and the mover", () => {
    const { before, after } = afterShift();
    const trace = nextTrace(nextTrace(undefined, before), after);
    expect(trace.seat).toBe(2);
    expect(trace.insertion).toBe("N3");
    expect(trace.route).toBeUndefined();
  });

  it("Bot shifts and walks: the route runs from the post-shift square to the end square", () => {
    const { before, after, board, pawns } = afterShift();
    const from = pawns[1]!;
    const to = reachableSquares(board, from).find((sq) => !sameSquare(sq, from));
    expect(to).toBeDefined();
    let trace = nextTrace(nextTrace(undefined, before), after);
    trace = nextTrace(trace, view({ board, squares: [pawns[0]!, to!], turnSeat: 1, step: "shift", lastInsertion: "N3" }));
    expect(trace.route?.[0]).toEqual(from);
    expect(trace.route?.at(-1)).toEqual(to);
    expect(trace.insertion).toBe("N3");
  });

  it("Staying put: no route", () => {
    const { before, after, board, pawns } = afterShift();
    let trace = nextTrace(nextTrace(undefined, before), after);
    trace = nextTrace(trace, view({ board, squares: pawns, turnSeat: 1, step: "shift", lastInsertion: "N3" }));
    expect(trace.route).toBeUndefined();
    expect(trace.insertion).toBe("N3");
  });

  it("the last move of a finished game is traced", () => {
    const { before, after, board, pawns } = afterShift();
    const to = reachableSquares(board, pawns[1]!).find((sq) => !sameSquare(sq, pawns[1]!))!;
    let trace = nextTrace(nextTrace(undefined, before), after);
    trace = nextTrace(trace, view({ board, squares: [pawns[0]!, to], turnSeat: 2, step: "move", lastInsertion: "N3", finished: true }));
    expect(trace.route?.at(-1)).toEqual(to);
  });

  it("Next shift replaces the marks", () => {
    const { before, after, board, pawns } = afterShift();
    const to = reachableSquares(board, pawns[1]!).find((sq) => !sameSquare(sq, pawns[1]!))!;
    let trace = nextTrace(nextTrace(undefined, before), after);
    trace = nextTrace(trace, view({ board, squares: [pawns[0]!, to], turnSeat: 1, step: "shift", lastInsertion: "N3" }));
    const next = shiftBoard(board, "W1", 0, [pawns[0]!, to]);
    trace = nextTrace(trace, view({ board: next.board, squares: [...next.pawns], turnSeat: 1, step: "move", lastInsertion: "W1" }));
    expect(trace.seat).toBe(1);
    expect(trace.route).toBeUndefined();
    expect(trace.insertion).toBe("W1");
  });

  it("a move step ending without a move (seat kicked) draws no route", () => {
    const { before, after, board, pawns } = afterShift();
    let trace = nextTrace(nextTrace(undefined, before), after);
    trace = nextTrace(trace, { ...view({ board, squares: [pawns[0]!], turnSeat: 1, step: "shift", lastInsertion: "N3" }) });
    expect(trace.route).toBeUndefined();
    expect(trace.moving).toBeUndefined();
  });

  it("returns the same object when nothing changed", () => {
    const { before, after } = afterShift();
    const trace = nextTrace(nextTrace(undefined, before), after);
    expect(nextTrace(trace, after)).toBe(trace);
  });
});
