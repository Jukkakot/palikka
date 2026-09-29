/** The one-time tips of the first game, in the order they are offered. */
export const TIPS = ["goal", "place"] as const;
export type TipId = (typeof TIPS)[number];

/** What the game screen tells the tips; plain values, independent of the session and the view model. */
export interface TipSituation {
  /** The viewer plays in a running game: seated, not watching, not finished. */
  playing: boolean;
  isMyTurn: boolean;
}

/** Whether a tip's moment is now. */
export function isRelevant(tip: TipId, s: TipSituation): boolean {
  if (!s.playing) return false;
  switch (tip) {
    case "goal":
      return true;
    case "place":
      return s.isMyTurn;
  }
}

/** The first unseen tip whose moment is now; undefined when there is none. */
export function pickTip(s: TipSituation, seen: ReadonlySet<TipId>): TipId | undefined {
  return TIPS.find((tip) => !seen.has(tip) && isRelevant(tip, s));
}

const KEY = "palikka.tips.seen";

/** The tips seen in this browser; empty when storage is blocked or holds garbage. */
export function loadSeenTips(storage?: Storage): Set<TipId> {
  try {
    const raw: unknown = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((t): t is TipId => (TIPS as readonly unknown[]).includes(t)) : []);
  } catch {
    return new Set();
  }
}

export function saveSeenTips(seen: ReadonlySet<TipId>, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Storage blocked (private mode): tips still work for this game, and show again next time.
  }
}

/** Forgets every seen tip, so all of them show again in the next game. */
export function resetTips(storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).removeItem(KEY);
  } catch {
    // Storage blocked: nothing was remembered either.
  }
}
