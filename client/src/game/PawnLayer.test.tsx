// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { reachableSquares, setupBoard, shiftBoard, shortestPath, square, type Square } from "@labyrinth/rules";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import type { SeatView } from "../session/viewModel.ts";
import { PawnLayer } from "./PawnLayer.tsx";
import { pawnMotion, RIDE_MS, STEP_MAX_MS } from "./pawnMotion.ts";

const board = setupBoard(7);
const at = (sq: Square) => `translate(${sq.col * 100}px, ${sq.row * 100}px)`;
const seat = (sq: Square): SeatView[] => [{ seat: 1, sessionId: "me", name: "Maija", connected: true, isMe: true, isBot: false, cards: 0, found: [], square: sq }];
const pawn = () => screen.getByRole("img", { name: "Maija (sinä)" });
const layer = (sq: Square, b = board) => <svg>{<PawnLayer seats={seat(sq)} board={b} />}</svg>;

/** The farthest square reachable from the top-left corner, so the walk has several steps. */
const start = square(0, 0);
const far = reachableSquares(board, start).reduce((best, sq) =>
  shortestPath(board, start, sq)!.length > shortestPath(board, start, best)!.length ? sq : best,
);

describe("pawnMotion", () => {
  it("walks a shortest path, at most about a second in total", () => {
    const motion = pawnMotion(start, far, board, false, false);
    expect(motion).toMatchObject({ kind: "walk", path: shortestPath(board, start, far) });
    if (motion.kind !== "walk") return;
    expect(motion.stepMs).toBeLessThanOrEqual(STEP_MAX_MS);
    expect(motion.stepMs * (motion.path.length - 1)).toBeLessThanOrEqual(1000);
  });

  it("rides one square during a shift, jumps when wrapping", () => {
    expect(pawnMotion(square(2, 3), square(3, 3), board, true, false)).toEqual({ kind: "slide", ms: RIDE_MS });
    expect(pawnMotion(square(6, 3), square(0, 3), board, true, false)).toEqual({ kind: "jump" });
  });

  it("jumps with reduced motion or without a path", () => {
    expect(pawnMotion(start, far, board, false, true)).toEqual({ kind: "jump" });
    const unreachable = [...Array(49).keys()]
      .map((i) => square(Math.floor(i / 7), i % 7))
      .find((sq) => !shortestPath(board, start, sq))!;
    expect(pawnMotion(start, unreachable, board, false, false)).toEqual({ kind: "jump" });
  });
});

describe("board-view › Pawns walk", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Someone moves: the pawn walks square by square to the target", () => {
    const path = shortestPath(board, start, far)!;
    expect(path.length).toBeGreaterThan(2);
    const { rerender } = render(layer(start));
    rerender(layer(far));

    expect(pawn().style.transform).toBe(at(path[1]!));
    const { stepMs } = pawnMotion(start, far, board, false, false) as { stepMs: number };
    act(() => vi.advanceTimersByTime(stepMs));
    expect(pawn().style.transform).toBe(at(path[2]!));
    act(() => vi.advanceTimersByTime(stepMs * path.length));
    expect(pawn().style.transform).toBe(at(far));
    expect(pawn().style.transition).toContain("linear");
  });

  it("Reduced motion: the pawn appears on the target without animation", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    const { rerender } = render(layer(start));
    rerender(layer(far));
    expect(pawn().style.transform).toBe(at(far));
    expect(pawn().style.transition).toBe("none");
  });

  it("riding a shift slides; wrapping to the inserted tile jumps", () => {
    const { rerender } = render(layer(square(2, 3)));
    const shifted = shiftBoard(board, "N3", 0, [square(2, 3)]);
    rerender(layer(shifted.pawns[0]!, shifted.board));
    expect(pawn().style.transform).toBe(at(square(3, 3)));
    expect(pawn().style.transition).toContain(`${RIDE_MS}ms`);

    const wrap = shiftBoard(shifted.board, "S5", 0, [square(0, 5)]);
    rerender(layer(square(0, 5), shifted.board));
    rerender(layer(wrap.pawns[0]!, wrap.board));
    expect(wrap.pawns[0]).toEqual(square(6, 5));
    expect(pawn().style.transform).toBe(at(square(6, 5)));
    expect(pawn().style.transition).toBe("none");
  });
});
