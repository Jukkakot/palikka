/** Per-tab reconnection token: sessionStorage makes every tab its own player. */
const KEY = "palikka.session";

export function loadToken(storage: Storage | undefined = globalThis.sessionStorage): string | undefined {
  try {
    return storage?.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(token: string, storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.setItem(KEY, token);
  } catch {
    // Storage blocked (private mode): the tab simply cannot rejoin after a reload.
  }
}

export function clearToken(storage: Storage | undefined = globalThis.sessionStorage): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
