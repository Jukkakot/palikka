// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptiedSince, filledSince } from "./boardDiff.ts";
import { useCountUp, useEnded, useLastMove, usePrevious } from "./hooks.ts";

const empty = () => Array<number>(16).fill(0);
const withSquares = (board: readonly number[], owner: number, squares: number[]) => board.map((v, i) => (squares.includes(i) ? owner : v));

describe("board diff", () => {
  it("filled squares: added, several, removed, identical", () => {
    const a = empty();
    const b = withSquares(a, 1, [0, 1]);
    expect([...filledSince(a, b)]).toEqual([0, 1]);
    const c = withSquares(withSquares(b, 2, [5]), 3, [10, 11]);
    expect([...filledSince(b, c)]).toEqual([5, 10, 11]);
    expect(filledSince(c, b).size).toBe(0);
    expect(emptiedSince(c, b)).toBe(true);
    expect(filledSince(b, [...b]).size).toBe(0);
    expect(emptiedSince(b, [...b])).toBe(false);
    expect(filledSince(undefined, b).size).toBe(0);
    expect(filledSince(Array<number>(4).fill(0), b).size).toBe(0);
  });
});

const lastMove = (board: readonly number[], key: unknown = "g1") =>
  renderHook(({ board, key }: { board: readonly number[]; key: unknown }) => useLastMove(board, key), { initialProps: { board, key } });

describe("game-motion › Last move marked on the board", () => {
  it("Bot move marked; an unchanged board keeps the mark", () => {
    const start = empty();
    const { result, rerender } = lastMove(start);
    const moved = withSquares(start, 2, [3, 7]);
    rerender({ board: moved, key: "g1" });
    expect([...result.current!]).toEqual([3, 7]);
    rerender({ board: [...moved], key: "g1" });
    expect([...result.current!]).toEqual([3, 7]);
  });

  it("Next move moves the mark", () => {
    const first = withSquares(empty(), 1, [0]);
    const { result, rerender } = lastMove(empty());
    rerender({ board: first, key: "g1" });
    rerender({ board: withSquares(first, 2, [15]), key: "g1" });
    expect([...result.current!]).toEqual([15]);
  });

  it("Several moves at once", () => {
    const { result, rerender } = lastMove(empty());
    rerender({ board: withSquares(withSquares(empty(), 1, [0, 1]), 2, [14, 15]), key: "g1" });
    expect([...result.current!]).toEqual([0, 1, 14, 15]);
  });

  it("Undo clears the mark", () => {
    const one = withSquares(empty(), 1, [0]);
    const two = withSquares(one, 2, [15]);
    const { result, rerender } = lastMove(one);
    rerender({ board: two, key: "g1" });
    rerender({ board: one, key: "g1" });
    expect(result.current).toBeUndefined();
  });

  it("Reloaded game: the first board and another game have no mark", () => {
    const played = withSquares(empty(), 1, [0, 1, 2]);
    const { result, rerender } = lastMove(played);
    expect(result.current).toBeUndefined();
    rerender({ board: withSquares(played, 2, [9]), key: "g2" });
    expect(result.current).toBeUndefined();
  });
});

describe("motion hooks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usePrevious keeps the value before the last change across re-renders", () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 1 } });
    expect(result.current).toBeUndefined();
    rerender({ v: 2 });
    expect(result.current).toBe(1);
    rerender({ v: 2 });
    expect(result.current).toBe(1);
  });

  it("useEnded: a seen transition celebrates, an already finished game does not", () => {
    const seen = renderHook(({ done }) => useEnded(done), { initialProps: { done: false } });
    expect(seen.result.current).toBe(false);
    seen.rerender({ done: true });
    expect(seen.result.current).toBe(true);
    const late = renderHook(({ done }) => useEnded(done), { initialProps: { done: true } });
    expect(late.result.current).toBe(false);
  });

  it("useCountUp returns the target when not running or with reduced motion", () => {
    expect(renderHook(() => useCountUp(42, false)).result.current).toBe(42);
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
    expect(renderHook(() => useCountUp(42, true)).result.current).toBe(42);
  });

  it("useCountUp starts from the start value when running", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    expect(renderHook(() => useCountUp(42, true, 900, -5)).result.current).toBe(-5);
  });
});
