import { describe, expect, it } from "vitest";
import { formatTime, loadPuzzleSave, localDate, previousDate, progressFor, recordSolve, resultFor, savePuzzle, type PuzzleSave } from "./puzzleStore.ts";

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

const empty = (): PuzzleSave => loadPuzzleSave(memoryStore());

describe("puzzleStore", () => {
  it("Streak continues", () => {
    let save = recordSolve(empty(), "2026-09-30", 6, 90_000);
    save = recordSolve(save, "2026-10-01", 7, 120_000);
    expect(save.stats.streak).toBe(2);
    expect(save.result).toMatchObject({ date: "2026-10-01", streak: 2 });
  });

  it("Streak restarts", () => {
    let save = recordSolve(empty(), "2026-09-27", 8, 90_000);
    save = recordSolve(save, "2026-09-28", 5, 90_000);
    save = recordSolve(save, "2026-10-01", 7, 90_000);
    expect(save.stats).toMatchObject({ streak: 1, longestStreak: 2, solved: 3 });
  });

  it("Personal best", () => {
    let save = recordSolve(empty(), "2026-09-25", 7, 150_000);
    expect(save.result?.record).toBe(true);
    save = recordSolve(save, "2026-09-26", 7, 170_000);
    expect(save.result?.record).toBe(false);
    save = recordSolve(save, "2026-10-02", 7, 100_000);
    expect(save.result?.record).toBe(true);
    expect(save.stats.best[7]).toBe(100_000);
  });

  it("records a day only once", () => {
    const once = recordSolve(empty(), "2026-10-01", 7, 100_000);
    expect(recordSolve(once, "2026-10-01", 7, 50_000)).toBe(once);
  });

  it("Continue later: today's progress survives a save and load", () => {
    const store = memoryStore();
    const progress = { date: "2026-10-01", placements: [{ piece: 9, orientation: 0, row: 0, col: 0 }], elapsedMs: 42_000 };
    savePuzzle({ ...loadPuzzleSave(store), progress }, store);
    expect(progressFor(loadPuzzleSave(store), "2026-10-01")).toEqual(progress);
  });

  it("New day: yesterday's progress and result are not today's", () => {
    const save = recordSolve({ ...empty(), progress: { date: "2026-09-30", placements: [], elapsedMs: 5000 } }, "2026-09-30", 6, 5000);
    expect(progressFor(save, "2026-10-01")).toEqual({ date: "2026-10-01", placements: [], elapsedMs: 0 });
    expect(resultFor(save, "2026-10-01")).toBeUndefined();
  });

  it("drops a save of another version or a broken one, and survives blocked storage", () => {
    const store = memoryStore();
    store.setItem("palikka.puzzle", JSON.stringify({ v: 0, stats: { solved: 3 } }));
    expect(loadPuzzleSave(store).stats.solved).toBe(0);
    store.setItem("palikka.puzzle", "{broken");
    expect(loadPuzzleSave(store).stats.solved).toBe(0);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(loadPuzzleSave(blocked).stats.solved).toBe(0);
    expect(() => savePuzzle(empty(), blocked)).not.toThrow();
  });

  it("dates and times", () => {
    expect(localDate(new Date(2026, 8, 5, 23, 59))).toBe("2026-09-05");
    expect(previousDate("2026-10-01")).toBe("2026-09-30");
    expect(previousDate("2026-01-01")).toBe("2025-12-31");
    expect(formatTime(154_900)).toBe("2:34");
  });
});
