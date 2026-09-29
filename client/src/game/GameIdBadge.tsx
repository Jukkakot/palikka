import { IconShare2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { inviteUrl } from "../session/inviteLink.ts";
import { isLocalRoomId } from "../session/localGameStore.ts";
import { Badge } from "../ui/Badge.tsx";
import { useCopyFeedback } from "../ui/copyFeedback.ts";
import { browserSharer, shareOrCopy, type Sharer } from "../ui/share.ts";
import styles from "./GameIdBadge.module.css";

/** What the shared text asks the friend to do; the link is the same (an invite link opens both). */
export type LinkInvite = "join" | "watch";

/**
 * Small game id in the top bar. For a server game a tap hands out the game's link (share sheet, else
 * clipboard, else a selectable field). A game on the device has no link: it shows a short label that
 * does nothing on tap. The bug-report line lives in the settings screen.
 */
export function GameIdBadge({
  roomId,
  invite = "watch",
  sharer = browserSharer(),
}: {
  roomId: string;
  invite?: LinkInvite;
  sharer?: Sharer;
}) {
  const { t } = useTranslation();
  const [state, setState] = useCopyFeedback();

  if (isLocalRoomId(roomId)) {
    return <span className={`${styles.local} ${styles.label}`}>{t("game.localLabel")}</span>;
  }

  const onTap = async () => {
    const url = inviteUrl(roomId);
    const text = invite === "join" ? t("waiting.shareText") : t("game.watchShareText");
    const outcome = await shareOrCopy(sharer, { url, text }, url);
    setState(outcome === "copied" ? { kind: "copied" } : outcome === "failed" ? { kind: "fallback", text: url } : { kind: "idle" });
  };

  return (
    <div className={styles.wrap}>
      <Badge onClick={() => void onTap()} aria-label={t("game.linkLabel", { id: roomId })}>
        <span className={styles.label}>{roomId}</span>
        <IconShare2 size={14} aria-hidden="true" />
      </Badge>
      <span className={styles.status} role="status">
        {state.kind === "copied" ? t("waiting.copied") : ""}
      </span>
      {state.kind === "fallback" && (
        <label className={styles.fallback}>
          {t("game.linkFallback")}
          <input readOnly value={state.text} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </label>
      )}
    </div>
  );
}
