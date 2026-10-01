/**
 * The game to offer "Jatka peliä" for after the app was closed. Unlike the per-tab token
 * (sessionStorage), it lives in localStorage, so it survives closing the tab or app.
 */
import { storageKey } from "../config.ts";
import { isLocalToken } from "./localGameStore.ts";

const key = () => storageKey("resume");

/** The server holds a dropped seat this long; an older record cannot be resumed. */
export const RESUME_HOLD_MS = 5 * 60_000;

export interface ResumeRecord {
  token: string;
  roomId: string;
  /** When the player was last seen connected (ms since epoch). */
  seenAt: number;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The remembered game if it may still be held; a stale or broken record is dropped. */
export function loadResume(now = Date.now(), store = storage()): ResumeRecord | undefined {
  try {
    const raw = store?.getItem(key());
    if (!raw) return undefined;
    const r = JSON.parse(raw) as Partial<ResumeRecord>;
    // A game on the device waits for the player as long as it is saved.
    const held = typeof r.seenAt === "number" && (now - r.seenAt < RESUME_HOLD_MS || (typeof r.token === "string" && isLocalToken(r.token)));
    if (typeof r.token === "string" && typeof r.roomId === "string" && typeof r.seenAt === "number" && held) {
      return { token: r.token, roomId: r.roomId, seenAt: r.seenAt };
    }
    store?.removeItem(key());
  } catch {
    clearResume(store);
  }
  return undefined;
}

export function saveResume(token: string, roomId: string, now = Date.now(), store = storage()): void {
  try {
    store?.setItem(key(), JSON.stringify({ token, roomId, seenAt: now } satisfies ResumeRecord));
  } catch {
    // Storage blocked (private mode): no resume after closing, reload still works.
  }
}

export function clearResume(store = storage()): void {
  try {
    store?.removeItem(key());
  } catch {
    // ignore
  }
}
