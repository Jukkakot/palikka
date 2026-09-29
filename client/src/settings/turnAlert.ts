import { useEffect } from "react";
import i18n from "../i18n";
import type { GameView } from "../session/viewModel.ts";
import { playSound, vibrate } from "./feedback.ts";
import { getSettings } from "./settings.ts";

type AlertView = Pick<GameView, "isMyTurn" | "spectating" | "myAutoplay" | "finished" | "phase" | "seats">;

/**
 * Whether the viewer is on turn in a way worth announcing: their own seat, played by them, in a
 * running game with someone else.
 */
export function isAlertTurn(view: AlertView): boolean {
  return (
    view.isMyTurn && !view.spectating && !view.myAutoplay && !view.finished && view.phase === "playing" && view.seats.length > 1
  );
}

/**
 * Turn notification: when the viewer's turn begins, a sound and a short vibration (per the
 * settings), and while the page is hidden the tab title says it is their turn, until they come
 * back or the turn ends.
 */
export function useTurnAlert(view: AlertView): void {
  const on = isAlertTurn(view);
  useEffect(() => {
    if (!on) return;
    playSound("turn");
    vibrate();
    const normal = document.title;
    const sync = () => {
      document.title = document.hidden && getSettings().turnTitle ? i18n.t("turnAlert.title", { title: normal }) : normal;
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.title = normal;
    };
  }, [on]);
}
