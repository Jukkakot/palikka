import { storageKey } from "../config.ts";

/** Per-tab reconnection token: sessionStorage makes every tab its own player. */
const key = () => storageKey("session");

export function loadToken(storage: Storage | undefined = globalThis.sessionStorage): string | undefined {
  try {
    return storage?.getItem(key()) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(token: string, storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.setItem(key(), token);
  } catch {
    // Storage blocked (private mode): the tab simply cannot rejoin after a reload.
  }
}

export function clearToken(storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.removeItem(key());
  } catch {
    // ignore
  }
}
