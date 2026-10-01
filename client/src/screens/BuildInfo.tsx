import { useTranslation } from "react-i18next";
import { clientBuiltAt } from "../config.ts";
import { formatDateTime } from "../i18n/formatDateTime.ts";
import type { ServerWake } from "@game-kit/client";

/** Build times of the running client and server, so anyone can see that the newest of both are live. */
export function BuildInfo({ wake, clientBuilt = clientBuiltAt() }: { wake: ServerWake; clientBuilt?: string | null }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? "fi";
  // null: a development build without a build time; undefined: not known.
  const time = (builtAt: string | null | undefined) => {
    if (builtAt === null) return t("build.dev");
    const date = builtAt === undefined ? undefined : new Date(builtAt);
    if (!date || Number.isNaN(date.getTime())) return t("build.unknown");
    return t("build.time", formatDateTime(date, lng));
  };

  let server: string;
  if (wake.state === "waking") server = t("build.serverWaking");
  else if (wake.state === "failed") server = t("build.serverNoAnswer");
  else server = t("build.server", { time: time(wake.server?.builtAt) });

  return (
    <>
      <div>{t("build.client", { time: time(clientBuilt) })}</div>
      <div>{server}</div>
    </>
  );
}
