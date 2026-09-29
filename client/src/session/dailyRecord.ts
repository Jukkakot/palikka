/**
 * The daily puzzle on this device: which date, the current attempt's saved game, the puzzle's par
 * and the day's best solve over all attempts. A record of an earlier date is replaced by today's.
 */
const KEY = "labyrinth.daily";

export interface DailyResult {
  /** Turns taken, the solving turn included. */
  turns: number;
}

export interface DailyRecord {
  /** The puzzle's date, `YYYY-MM-DD` (local). */
  date: string;
  /** The current attempt's game. */
  roomId: string;
  /** The fewest turns possible. */
  par: number;
  /** The day's best solve (fewest turns). */
  best?: DailyResult;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The local calendar date `YYYY-MM-DD`: the puzzle of the day. */
export function todayString(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today's record; undefined when there is none, it is of another date, or it is broken. */
export function loadDailyRecord(date = todayString(), store = storage()): DailyRecord | undefined {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return undefined;
    const record = JSON.parse(raw) as DailyRecord;
    // Records of the first puzzle format (no par) are ignored.
    return record.date === date && typeof record.roomId === "string" && typeof record.par === "number" ? record : undefined;
  } catch {
    return undefined;
  }
}

/** The recorded attempt of the puzzle in `roomId`, whatever its date. */
export function dailyRecordOf(roomId: string, store = storage()): DailyRecord | undefined {
  try {
    const raw = store?.getItem(KEY);
    const record = raw ? (JSON.parse(raw) as DailyRecord) : undefined;
    return record?.roomId === roomId ? record : undefined;
  } catch {
    return undefined;
  }
}

export function saveDailyRecord(record: DailyRecord, store = storage()): void {
  try {
    store?.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage blocked: the attempt plays on, it just is not remembered.
  }
}

/** Stores a solve of the puzzle in `roomId` (the recorded attempt) as the day's best if it beats it. */
export function saveDailyResult(roomId: string, result: DailyResult, store = storage()): void {
  const record = dailyRecordOf(roomId, store);
  if (record && (!record.best || result.turns < record.best.turns)) saveDailyRecord({ ...record, best: result }, store);
}
