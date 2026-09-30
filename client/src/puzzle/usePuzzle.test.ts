// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { dailyPuzzle, puzzleSquares } from "@palikka/rules";
import { describe, expect, it, vi } from "vitest";
import { aimOf } from "../game/placing.ts";
import { log } from "../logging/logger.ts";
import { loadPuzzleSave } from "./puzzleStore.ts";
import { usePuzzle } from "./usePuzzle.ts";

const DATE = "2026-10-01";
const puzzle = dailyPuzzle(DATE);

function memoryStore(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

function setup(visible = true) {
  let time = 1_000_000;
  const store = memoryStore();
  const hook = renderHook(() => usePuzzle({ date: DATE, now: () => time, visible: () => visible, store }));
  return { ...hook, store, advance: (ms: number) => (time += ms) };
}

/** Places a solution move: choose, step to its orientation, aim exactly with the keys, "Aseta". */
function place(result: { current: ReturnType<typeof usePuzzle> }, index: number) {
  const move = puzzle.solution[index]!;
  act(() => result.current.choose(move.piece));
  for (let step = 0; step < 8 && result.current.chosen!.orientation !== move.orientation; step++) {
    act(() => (step === 4 ? result.current.mirror() : result.current.turn()));
  }
  const { square } = aimOf(move, puzzle.size);
  const start = puzzle.shape[0]!;
  const size = puzzle.size;
  act(() => result.current.moveBy(0, 0));
  act(() => result.current.moveBy(Math.floor(square / size) - Math.floor(start / size), (square % size) - (start % size)));
  act(() => result.current.place());
}

describe("daily-puzzle › usePuzzle", () => {
  it("places the solution's pieces and marks the puzzle Solved, recorded once and logged", () => {
    const info = vi.spyOn(log, "info").mockImplementation(() => {});
    const { result, store, advance } = setup();
    advance(90_000);
    for (let i = 0; i < puzzle.solution.length; i++) place(result, i);
    expect(result.current.placements).toHaveLength(puzzle.pieces.length);
    expect(result.current.result).toMatchObject({ date: DATE, ms: 90_000, streak: 1, record: true });
    expect(result.current.chosen).toBeUndefined();
    expect(loadPuzzleSave(store).stats.solved).toBe(1);
    expect(info).toHaveBeenCalledWith("client.puzzle.solved", { date: DATE, pieces: puzzle.pieces.length, seconds: 90 });
    info.mockRestore();
  });

  it("Lift a piece", () => {
    const { result } = setup();
    place(result, 0);
    place(result, 1);
    const second = puzzle.solution[1]!;
    act(() => result.current.click(puzzleSquares(puzzle, second)[0]!));
    expect(result.current.placements).toEqual([puzzle.solution[0]]);
    expect(result.current.chosen).toEqual({ piece: second.piece, orientation: second.orientation });
    expect(result.current.preview).toMatchObject({ move: second, legal: true });
  });

  it("Clear", () => {
    const { result, store } = setup();
    for (let i = 0; i < 3; i++) place(result, i);
    act(() => result.current.clear());
    expect(result.current.placements).toEqual([]);
    expect(loadPuzzleSave(store).progress?.placements).toEqual([]);
  });

  it("keeps progress in the store after every placement", () => {
    const { result, store } = setup();
    place(result, 0);
    expect(loadPuzzleSave(store).progress).toMatchObject({ date: DATE, placements: [puzzle.solution[0]] });
  });

  it("the clock does not run while the page is hidden", () => {
    const { result, advance } = setup(false);
    advance(60_000);
    for (let i = 0; i < puzzle.solution.length; i++) place(result, i);
    expect(result.current.result?.ms).toBe(0);
  });
});
