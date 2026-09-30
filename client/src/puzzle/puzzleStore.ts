import type { Placement } from "@palikka/rules";

/**
 * The daily puzzle on this device (localStorage `palikka.puzzle`): today's progress, today's result
 * and the records (streaks, solved count, best time per piece count). Storage blocked (private
 * mode): the puzzle still plays, nothing is remembered.
 */
const KEY = "palikka.puzzle";
const VERSION = 1;

export interface PuzzleProgress {
  date: string;
  placements: Placement[];
  elapsedMs: number;
}

export interface PuzzleResult {
  date: string;
  ms: number;
  pieces: number;
  /** The streak including this day. */
  streak: number;
  /** Best for its piece count (or the first of that count). */
  record: boolean;
}

export interface PuzzleStats {
  /** Date of the latest solved puzzle. */
  lastSolved?: string;
  streak: number;
  longestStreak: number;
  solved: number;
  /** Best time in ms per piece count. */
  best: Record<number, number>;
}

export interface PuzzleSave {
  v: typeof VERSION;
  progress?: PuzzleProgress;
  /** The latest solve; only today's matters. */
  result?: PuzzleResult;
  stats: PuzzleStats;
}

const EMPTY: PuzzleSave = { v: VERSION, stats: { streak: 0, longestStreak: 0, solved: 0, best: {} } };

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Today's local date as `YYYY-MM-DD`. */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The day before a `YYYY-MM-DD` date. */
export function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

/** The save, or an empty one when there is none, it is of another version, or it is broken. */
export function loadPuzzleSave(store = storage()): PuzzleSave {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return EMPTY;
    const save = JSON.parse(raw) as PuzzleSave;
    if (save?.v !== VERSION || typeof save.stats?.solved !== "number") return EMPTY;
    return save;
  } catch {
    return EMPTY;
  }
}

export function savePuzzle(save: PuzzleSave, store = storage()): void {
  try {
    store?.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage blocked or full: play on without remembering.
  }
}

/** Today's progress: the saved one when it is today's, else an empty board at 0:00. */
export function progressFor(save: PuzzleSave, date: string): PuzzleProgress {
  return save.progress?.date === date ? save.progress : { date, placements: [], elapsedMs: 0 };
}

/** Today's result, when today's puzzle is solved. */
export function resultFor(save: PuzzleSave, date: string): PuzzleResult | undefined {
  return save.result?.date === date ? save.result : undefined;
}

/**
 * Records a solve of `date`'s puzzle: the streak continues when the day before was solved, else it
 * restarts at 1; the best time for the piece count is kept. Recording a day twice changes nothing.
 */
export function recordSolve(save: PuzzleSave, date: string, pieces: number, ms: number): PuzzleSave {
  if (resultFor(save, date)) return save;
  const { stats } = save;
  const streak = stats.lastSolved === previousDate(date) ? stats.streak + 1 : 1;
  const previousBest = stats.best[pieces];
  const record = previousBest === undefined || ms < previousBest;
  return {
    v: VERSION,
    progress: save.progress?.date === date ? { ...save.progress, elapsedMs: ms } : save.progress,
    result: { date, ms, pieces, streak, record },
    stats: {
      lastSolved: date,
      streak,
      longestStreak: Math.max(stats.longestStreak, streak),
      solved: stats.solved + 1,
      best: record ? { ...stats.best, [pieces]: ms } : stats.best,
    },
  };
}

/** Milliseconds as m:ss. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
