/**
 * Development only: `?dev=1v3` starts a quick game against 3 bots (1–3) on the device at once,
 * so a UI check or a quick try lands on the board without tapping through the start
 * screen. Undefined in a production build, where the parameter does nothing.
 */
export function devBotCount(search = globalThis.location?.search ?? "", isDev = import.meta.env.DEV): number | undefined {
  if (!isDev) return undefined;
  const match = /^1v([1-3])$/.exec(new URLSearchParams(search).get("dev") ?? "");
  return match ? Number(match[1]) : undefined;
}

/** Development only: `?dev=0v3` starts watching a game of 3 bots (2–4). */
export function devWatchCount(search = globalThis.location?.search ?? "", isDev = import.meta.env.DEV): number | undefined {
  if (!isDev) return undefined;
  const match = /^0v([2-4])$/.exec(new URLSearchParams(search).get("dev") ?? "");
  return match ? Number(match[1]) : undefined;
}

/** Removes `?dev=…` from the address, so leaving the game or reloading does not start another one. */
export function dropDevShortcut(): void {
  const url = new URL(globalThis.location.href);
  if (!url.searchParams.has("dev")) return;
  url.searchParams.delete("dev");
  globalThis.history.replaceState(globalThis.history.state, "", url);
}
