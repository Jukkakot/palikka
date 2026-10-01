import { useTranslation } from "react-i18next";
import { formatDateTime } from "../i18n/formatDateTime.ts";
import { clientVersion } from "@game-kit/client";

/**
 * The line a player pastes into a bug report: game id (when there is a game), local date and time,
 * app version.
 */
export function useCopyLine(roomId: string | undefined, now: () => Date = () => new Date()) {
  const { t, i18n } = useTranslation();
  return () => {
    const { date, time } = formatDateTime(now(), i18n.resolvedLanguage ?? "fi");
    const ver = clientVersion();
    return roomId ? t("game.copyLine", { id: roomId, date, time, ver }) : t("game.copyLineNoGame", { date, time, ver });
  };
}
