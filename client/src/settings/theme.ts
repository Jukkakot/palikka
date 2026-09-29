import { getSettings, subscribeSettings, type Theme } from "./settings.ts";

/** Forces light or dark through `data-theme` on `<html>`; "system" leaves it to the device. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Applies the stored theme now (before the first render) and again whenever it changes. */
export function startTheme(): void {
  let applied = getSettings().theme;
  applyTheme(applied);
  subscribeSettings(() => {
    const theme = getSettings().theme;
    if (theme === applied) return;
    applied = theme;
    applyTheme(theme);
  });
}
