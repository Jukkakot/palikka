import { useSyncExternalStore } from "react";

/**
 * The player's per-device settings: comfort choices kept in localStorage. They never change the
 * rules or anything other players see, and never reach the server.
 */
export type Theme = "system" | "light" | "dark";

export interface Settings {
  /** Tapping an edge arrow only previews; a second tap or "Työnnä" sends. Off: one tap shifts. */
  confirmShift: boolean;
  /** Tapping a reachable square only chooses it; a second tap or "Kävele tänne" moves. */
  confirmMove: boolean;
  theme: Theme;
  /** Short generated sounds (turn begins, treasure collected). */
  sounds: boolean;
  /** While the page is hidden, the tab title announces the viewer's turn. */
  turnTitle: boolean;
  /** A short vibration when the viewer's turn begins (where the device can vibrate). */
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  confirmShift: true,
  confirmMove: false,
  theme: "system",
  sounds: true,
  turnTitle: true,
  vibration: true,
};

const KEY = "labyrinth.settings";
const THEMES: readonly Theme[] = ["system", "light", "dark"];

function storageOf(storage?: Storage): Storage | undefined {
  try {
    return storage ?? globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The stored settings merged field by field over the defaults; the defaults when storage is blocked or holds garbage. */
export function loadSettings(storage?: Storage): Settings {
  try {
    const raw: unknown = JSON.parse(storageOf(storage)?.getItem(KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
    const r = raw as Record<string, unknown>;
    const flag = (name: keyof Omit<Settings, "theme">) => (typeof r[name] === "boolean" ? (r[name] as boolean) : DEFAULT_SETTINGS[name]);
    return {
      confirmShift: flag("confirmShift"),
      confirmMove: flag("confirmMove"),
      theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_SETTINGS.theme,
      sounds: flag("sounds"),
      turnTitle: flag("turnTitle"),
      vibration: flag("vibration"),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: Settings, storage?: Storage): void {
  try {
    storageOf(storage)?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode): the change still applies until the page is closed.
  }
}

let current: Settings | undefined;
const listeners = new Set<() => void>();

/** The settings in effect now (read from storage once, then kept in memory). */
export function getSettings(): Settings {
  current ??= loadSettings();
  return current;
}

/** Changes some settings: applied at once everywhere, and remembered on the device. */
export function updateSettings(patch: Partial<Settings>, storage?: Storage): Settings {
  current = { ...getSettings(), ...patch };
  saveSettings(current, storage);
  for (const listener of listeners) listener();
  return current;
}

/** Forgets the in-memory copy, so the next read comes from storage again (tests). */
export function reloadSettings(): void {
  current = undefined;
  for (const listener of listeners) listener();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current settings; re-renders when any of them changes. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
