import { useSyncExternalStore } from "react";

/** The stacked phone layout: the negation of the wide layout's media query (GameScreen.module.css). */
export const PHONE_QUERY = "not ((min-width: 900px) and (orientation: landscape))";

function query(): MediaQueryList | undefined {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY) : undefined;
}

function subscribe(listener: () => void): () => void {
  const list = query();
  list?.addEventListener("change", listener);
  return () => list?.removeEventListener("change", listener);
}

const isPhone = () => query()?.matches ?? false;

/**
 * Whether the stacked phone layout is in use; follows the window. The turned board, the zoom and
 * the Duo default all read this, so they switch together with the layout. False where media
 * queries are unavailable.
 */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => false);
}
