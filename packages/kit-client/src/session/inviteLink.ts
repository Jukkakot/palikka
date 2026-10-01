/** Game ids are short lowercase words joined by dashes (e.g. brave-otters-sing). */
const GAME_ID = /^[a-z0-9-]{1,64}$/;

/** The game id of an invite link (`?game=<id>`), or undefined. */
export function inviteFromUrl(search = globalThis.location?.search ?? ""): string | undefined {
  const id = new URLSearchParams(search).get("game")?.trim().toLowerCase();
  return id && GAME_ID.test(id) ? id : undefined;
}

/** The invite link of a game: this page with `?game=<id>`, keeping any `pool`. */
export function inviteUrl(roomId: string, location: Pick<Location, "origin" | "pathname" | "search"> = globalThis.location): string {
  const params = new URLSearchParams();
  const pool = new URLSearchParams(location.search).get("pool");
  if (pool) params.set("pool", pool);
  params.set("game", roomId);
  return `${location.origin}${location.pathname}?${params}`;
}

/** Drops `game` from the address bar (keeping `pool`), so a reload does not use the invite again. */
export function dropInviteFromUrl(win: Pick<Window, "location" | "history"> | undefined = globalThis.window): void {
  if (!win) return;
  const url = new URL(win.location.href);
  if (!url.searchParams.has("game")) return;
  url.searchParams.delete("game");
  win.history.replaceState(win.history.state, "", url);
}
