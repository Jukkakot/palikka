import { IconRobot, IconWifiOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { GameView } from "../session/viewModel.ts";
import styles from "./PlayerStrip.module.css";
import { SeatMark } from "./SeatMark.tsx";

/**
 * One chip per seat: the seat's colour or colours, the nickname (shortened with an ellipsis; the full name is in
 * the accessible text) and the score (the rules' points), a struck-through score once the colour
 * cannot move any more, and a dimmed chip with an icon when disconnected. A bot's chip has a robot icon, and so does a person's while the bot plays for them.
 */
export function PlayerStrip({ view }: { view: Pick<GameView, "seats"> }) {
  const { t } = useTranslation();
  return (
    <ul className={styles.strip} aria-label={t("progress.label")}>
      {view.seats.map((s) => {
        const summary = [
          t(s.isMe ? "progress.seatMe" : "progress.seat", { name: s.name }),
          s.isBot ? t("progress.bot") : undefined,
          s.autoplay ? t(s.isMe ? "progress.autoplayMine" : "progress.autoplay") : undefined,
          t("progress.score", { count: s.score }),
          s.out ? t("progress.out") : undefined,
          s.connected ? undefined : t("progress.disconnected"),
        ]
          .filter(Boolean)
          .join(", ");
        const cls = [styles.chip, s.isMe && styles.mine, !s.connected && styles.offline, s.out && styles.out].filter(Boolean).join(" ");
        return (
          <li key={s.seat} className={cls} data-seat={s.seat} data-offline={s.connected ? undefined : ""} data-autoplay={s.autoplay ? "" : undefined} data-out={s.out ? "" : undefined}>
            <span className={styles.srOnly}>{summary}</span>
            <span className={styles.marks}>
              {(s.colours.length > 0 ? s.colours : [s.seat]).map((colour) => (
                <SeatMark key={colour} seat={colour} isMe={s.isMe} />
              ))}
            </span>
            {(s.isBot || s.autoplay) && <IconRobot size={16} stroke={2} aria-hidden="true" className={styles.botIcon} />}
            <span className={styles.name} aria-hidden="true">
              {s.name}
            </span>
            <span className={styles.count} aria-hidden="true">
              {s.score}
            </span>
            {!s.connected && <IconWifiOff size={16} stroke={2} aria-hidden="true" className={styles.offlineIcon} />}
          </li>
        );
      })}
    </ul>
  );
}
