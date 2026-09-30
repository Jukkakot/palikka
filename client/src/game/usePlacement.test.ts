// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { ORIENTATIONS, PIECE_COUNT, pieceNumber } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { gameView } from "../test/views.ts";
import type { GameView } from "../session/viewModel.ts";
import type { ViewTransform } from "./boardView.ts";
import { hintMoves, movesCovering } from "./placing.ts";
import { usePlacement } from "./usePlacement.ts";

const L4 = pieceNumber("L4");
const I5 = pieceNumber("I5");
const X5 = pieceNumber("X5");

const setup = (view: GameView = gameView(), transform?: ViewTransform) =>
  renderHook((v: GameView) => usePlacement(v, transform), { initialProps: view });

/** Seat 1's view of `position` on its turn. */
const viewOf = (position: NonNullable<GameView["position"]>) => gameView({ position, board: position.cells });

describe("piece-controls › Choosing a piece", () => {
  it("Select: a fitting piece is chosen in its first orientation; tapping it again clears", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    expect(result.current.chosen).toEqual({ piece: I5, orientation: 0 });
    act(() => result.current.choose(I5));
    expect(result.current.chosen).toBeUndefined();
  });

  it("a piece that does not fit cannot be chosen", () => {
    const { result } = setup();
    expect(result.current.fitting?.has(X5)).toBe(false);
    act(() => result.current.choose(X5));
    expect(result.current.chosen).toBeUndefined();
  });

  it("Not my turn: nothing is chosen", () => {
    const { result } = setup(gameView({ isMyTurn: false, turnSeat: 2 }));
    act(() => result.current.choose(I5));
    expect(result.current.chosen).toBeUndefined();
    expect(result.current.fitting).toBeUndefined();
  });

  it("Frozen off turn: pieces that fit nowhere are known off turn too, and nothing is selectable", () => {
    // Colour 1's I5 stands in the first column; colour 2 takes its only free corner (5,1).
    const blocked = positionWith(
      [
        [1, placement("I5", ["#", "#", "#", "#", "#"], 0, 0)],
        [2, placement("I1", ["#"], 5, 1)],
      ],
      [1, 2],
    );
    const { result } = setup(gameView({ position: blocked, board: blocked.cells, isMyTurn: false, turnSeat: 2, turnColour: 2 }));
    expect(result.current.fitting).toBeUndefined();
    expect(result.current.fitsAnywhere?.size).toBe(0);
    const open = setup(gameView({ isMyTurn: false, turnSeat: 2, turnColour: 2 }));
    expect(open.result.current.fitsAnywhere?.has(I5)).toBe(true);
  });

  it("the choice is dropped when the turn changes", () => {
    const { result, rerender } = setup();
    act(() => result.current.choose(I5));
    rerender(gameView({ turn: 2, isMyTurn: false, turnSeat: 2 }));
    expect(result.current.chosen).toBeUndefined();
    rerender(gameView({ turn: 3 }));
    expect(result.current.chosen).toBeUndefined();
  });
});

describe("piece-controls › Turning and flipping", () => {
  it("Four turns: back to the first orientation; mirror changes it", () => {
    const { result } = setup();
    act(() => result.current.choose(L4));
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) {
      act(() => result.current.turn());
      seen.add(result.current.chosen!.orientation);
    }
    expect(result.current.chosen!.orientation).toBe(0);
    expect(seen.size).toBe(4);
    act(() => result.current.mirror());
    expect(result.current.chosen!.orientation).not.toBe(0);
    expect(ORIENTATIONS[L4]).toHaveLength(8);
  });
});

describe("piece-controls › Placing", () => {
  it("Two taps: the first aims, the second inside a legal preview gives the move", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    let move;
    act(() => {
      move = result.current.click(0);
    });
    expect(move).toBeUndefined();
    expect(result.current.preview?.legal).toBe(true);
    expect(result.current.ready).toBeDefined();
    act(() => {
      move = result.current.click(0);
    });
    expect(move).toEqual(result.current.ready);
  });

  it("Illegal: a tap inside an illegal preview gives nothing", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    act(() => void result.current.click(210));
    expect(result.current.preview?.legal).toBe(false);
    expect(result.current.preview?.reason).toBe("NOT_ON_START");
    let move;
    act(() => {
      move = result.current.click(210);
    });
    expect(move).toBeUndefined();
    expect(result.current.ready).toBeUndefined();
  });

  it("Illegal attempt shakes: a tap inside an illegal preview or Enter on it counts a nudge", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    act(() => void result.current.click(210));
    expect(result.current.nudge).toBe(0);
    act(() => void result.current.click(210));
    expect(result.current.nudge).toBe(1);
    act(() => void result.current.confirm());
    expect(result.current.nudge).toBe(2);
    act(() => void result.current.click(0));
    let move;
    act(() => {
      move = result.current.confirm();
    });
    expect(move).toBeDefined();
    expect(result.current.nudge).toBe(2);
  });

  it("arrow keys start at the start corner and move one square, exactly", () => {
    const { result } = setup();
    act(() => result.current.choose(pieceNumber("I1")));
    act(() => result.current.moveBy(0, 1));
    expect(result.current.preview?.squares).toEqual([0]);
    expect(result.current.preview?.legal).toBe(true);
    act(() => result.current.moveBy(0, 1));
    expect(result.current.preview?.squares).toEqual([1]);
    expect(result.current.preview?.legal).toBe(false);
    act(() => result.current.moveBy(-1, -5));
    expect(result.current.preview?.squares).toEqual([0]);
  });

  it("Hint: chooses the bot's move as a legal preview", () => {
    const { result } = setup();
    act(() => result.current.hint());
    expect(result.current.chosen).toBeDefined();
    expect(result.current.preview?.legal).toBe(true);
    expect(result.current.preview?.squares).toContain(0);
    expect(result.current.hints).toEqual({ index: 1, count: 3 });
  });

  it("Second best: a second press shows the second-best move, a fourth the best again", () => {
    const view = gameView();
    const { result } = setup(view);
    const moves = hintMoves(view.position!, 1, view.turn);
    act(() => result.current.hint());
    act(() => result.current.hint());
    expect(result.current.hints).toEqual({ index: 2, count: 3 });
    expect(result.current.preview?.move).toEqual(moves[1]);
    act(() => result.current.hint());
    act(() => result.current.hint());
    expect(result.current.hints).toEqual({ index: 1, count: 3 });
    expect(result.current.preview?.move).toEqual(moves[0]);
  });

  it("arrow keys move in screen directions on a turned board", () => {
    // Half a turn: screen right is board left.
    const { result } = setup(gameView(), { turns: 2 });
    act(() => result.current.choose(pieceNumber("I1")));
    act(() => result.current.moveBy(0, 1));
    act(() => result.current.moveBy(1, 0));
    expect(result.current.preview?.squares).toEqual([0]);
    act(() => result.current.moveBy(0, -1));
    expect(result.current.preview?.squares).toEqual([1]);
  });
});

describe("piece-controls › Corner first", () => {
  const I2 = pieceNumber("I2");

  it("Tap a corner: only the pieces that can cover it are selectable", () => {
    const { result } = setup();
    act(() => void result.current.click(0));
    expect(result.current.corner).toBe(0);
    expect(result.current.chosen).toBeUndefined();
    expect(result.current.fitting?.has(X5)).toBe(false);
    expect(result.current.fitting?.size).toBe(20);
  });

  it("Only one piece fits: it is chosen at once with its first spot as the preview", () => {
    const start = positionWith([[1, placement("I1", ["#"], 0, 0)]], [1, 2]);
    const all = Array.from({ length: PIECE_COUNT }, (_, p) => p).filter((p) => p !== I2);
    const position = { ...start, placed: { ...start.placed, 1: all }, turn: 1 };
    const { result } = setup(viewOf(position));
    act(() => void result.current.click(21));
    expect(result.current.chosen?.piece).toBe(I2);
    expect(result.current.preview?.legal).toBe(true);
    expect(result.current.preview?.move).toEqual(movesCovering(position, 1, 21, I2)[0]);
    expect(result.current.fitting).toEqual(new Set([I2]));
  });

  it("Step through spots: › twice shows the third spot; ‹ wraps around", () => {
    const view = gameView();
    const spots = movesCovering(view.position!, 1, 0, L4);
    const { result } = setup(view);
    act(() => void result.current.click(0));
    act(() => result.current.choose(L4));
    expect(result.current.spots).toEqual({ index: 1, count: spots.length });
    expect(result.current.preview?.move).toEqual(spots[0]);
    act(() => result.current.step(1));
    act(() => result.current.step(1));
    expect(result.current.spots?.index).toBe(3);
    expect(result.current.preview?.move).toEqual(spots[2]);
    act(() => result.current.step(-1));
    act(() => result.current.step(-1));
    act(() => result.current.step(-1));
    expect(result.current.spots?.index).toBe(spots.length);
    expect(result.current.preview?.move).toEqual(spots.at(-1));
  });

  it("Place from corner mode: a tap inside the preview gives its move", () => {
    const { result } = setup();
    act(() => void result.current.click(0));
    act(() => result.current.choose(L4));
    let move;
    act(() => {
      move = result.current.click(result.current.preview!.squares[0]!);
    });
    expect(move).toEqual(result.current.preview?.move);
  });

  it("Leave corner mode: a square that is not a free corner; the piece and its orientation stay", () => {
    const { result } = setup();
    act(() => void result.current.click(0));
    act(() => result.current.choose(L4));
    const orientation = result.current.chosen!.orientation;
    act(() => void result.current.click(210));
    expect(result.current.corner).toBeUndefined();
    expect(result.current.spots).toBeUndefined();
    expect(result.current.chosen).toEqual({ piece: L4, orientation });
  });

  it("the chosen piece again, or R, leaves corner mode keeping the piece", () => {
    const { result } = setup();
    act(() => void result.current.click(0));
    act(() => result.current.choose(L4));
    act(() => result.current.choose(L4));
    expect(result.current.corner).toBeUndefined();
    expect(result.current.chosen?.piece).toBe(L4);
    act(() => result.current.clear());
    act(() => void result.current.click(0));
    act(() => result.current.choose(L4));
    act(() => result.current.turn());
    expect(result.current.corner).toBeUndefined();
    expect(result.current.chosen?.piece).toBe(L4);
  });

  it("with a piece chosen first, tapping a free corner aims there (the normal flow)", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    act(() => void result.current.click(0));
    expect(result.current.corner).toBeUndefined();
    expect(result.current.preview?.legal).toBe(true);
  });
});

describe("piece-controls › Dragging a piece", () => {
  const I1 = pieceNumber("I1");
  // Colour 1 has I5 standing in the first column: its only free corner is (5,1).
  const tall = positionWith([[1, placement("I5", ["#", "#", "#", "#", "#"], 0, 0)]], [1, 2]);
  const played = { ...tall, turn: 1 };

  it("Drag from the tray: let go over a fitting spot; chosen, legal preview, nothing placed", () => {
    const { result } = setup();
    act(() => result.current.dragStart(I5));
    expect(result.current.dragging).toBe(true);
    expect(result.current.chosen?.piece).toBe(I5);
    // I5 lies flat (reference square third from the left): (0,1) is one square from its corner spot.
    act(() => result.current.dragTo(1));
    act(() => result.current.dragEnd(true));
    expect(result.current.dragging).toBe(false);
    expect(result.current.dropped).toBe(true);
    expect(result.current.preview?.legal).toBe(true);
    expect(result.current.preview?.squares).toContain(0);
    expect(result.current.ready).toBeDefined();
  });

  it("Live landing spot: legal where it fits, illegal with the reason where it touches its own piece", () => {
    const { result } = setup(viewOf(played));
    act(() => result.current.dragStart(I1));
    act(() => result.current.dragTo(5 * 20 + 1));
    expect(result.current.preview).toMatchObject({ legal: true, squares: [101] });
    act(() => result.current.dragTo(2 * 20 + 1));
    expect(result.current.preview).toMatchObject({ legal: false, squares: [41], reason: "EDGE_CONTACT" });
  });

  it("No far jumps: held three squares from the only spot, the landing spot stays under the piece", () => {
    const { result } = setup(viewOf(played));
    act(() => result.current.dragStart(I1));
    act(() => result.current.dragTo(8 * 20 + 1));
    expect(result.current.preview).toMatchObject({ legal: false, squares: [161] });
    act(() => result.current.dragTo(6 * 20 + 2));
    expect(result.current.preview).toMatchObject({ legal: true, squares: [101] });
  });

  it("Move the preview: dragging it two squares to the right moves the landing spot", () => {
    const { result } = setup();
    act(() => result.current.choose(I5));
    act(() => void result.current.click(0));
    const before = result.current.preview!.squares;
    act(() => result.current.dragStart());
    act(() => result.current.dragTo(before[2]! + 2));
    expect(result.current.preview?.squares).toEqual(before.map((s) => s + 2));
    expect(result.current.preview?.legal).toBe(false);
  });

  it("a drop on an illegal spot counts a nudge", () => {
    const { result } = setup(viewOf(played));
    act(() => result.current.dragStart(I1));
    act(() => result.current.dragTo(8 * 20 + 1));
    act(() => result.current.dragEnd(true));
    expect(result.current.nudge).toBe(1);
  });

  it("Drop outside: the piece stays chosen and the preview returns to where it was", () => {
    const { result } = setup();
    act(() => result.current.dragStart(I5));
    act(() => result.current.dragTo(20));
    act(() => result.current.dragTo(undefined));
    act(() => result.current.dragEnd(false));
    expect(result.current.chosen?.piece).toBe(I5);
    expect(result.current.preview).toBeUndefined();
    act(() => void result.current.click(0));
    const before = result.current.preview;
    act(() => result.current.dragStart());
    act(() => result.current.dragTo(300));
    act(() => result.current.dragEnd(false));
    expect(result.current.preview).toEqual(before);
    expect(result.current.dropped).toBe(false);
  });
});
