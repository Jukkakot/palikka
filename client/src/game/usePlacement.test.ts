// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { ORIENTATIONS, pieceNumber } from "@palikka/rules";
import { describe, expect, it } from "vitest";
import { gameView } from "../test/views.ts";
import type { GameView } from "../session/viewModel.ts";
import { usePlacement } from "./usePlacement.ts";

const L4 = pieceNumber("L4");
const I5 = pieceNumber("I5");
const X5 = pieceNumber("X5");

const setup = (view: GameView = gameView()) => renderHook((v: GameView) => usePlacement(v), { initialProps: view });

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
  });
});
