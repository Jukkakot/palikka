import { IconHome, IconRobot, IconWifiOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { GameView } from "../session/viewModel.ts";
import { Pawn } from "./Pawn.tsx";
import styles from "./PlayerStrip.module.css";
import { TREASURE_ICONS } from "./treasureIcons.ts";

/**
 * One chip per seat: pawn shape and colour, the nickname (shortened with an ellipsis; the full name is
 * in the accessible text), treasures found out of cards, and a dimmed chip with an icon when
 * disconnected. A bot's chip has a robot icon, and so does a person's while the bot plays for them. A chip also shows the seat's target when the viewer
 * knows it: their own, or every one for a spectator.
 */
export function PlayerStrip({ view }: { view: Pick<GameView, "seats"> }) {
  const { t } = useTranslation();
  const { seats } = view;
  return (
    <ul className={styles.strip} aria-label={t("progress.label")}>
      {seats.map((s) => {
        const target = s.target;
        const targetName = target === "home" ? t("progress.home") : target ? t(`treasures.${target}`) : undefined;
        const TargetIcon = target === "home" ? IconHome : target ? TREASURE_ICONS[target] : undefined;
        const showTarget = TargetIcon && targetName;
        const summary = [
          t(s.isMe ? "board.pawnMe" : "board.pawn", { name: s.name }),
          s.isBot ? t("progress.bot") : undefined,
          s.autoplay ? t(s.isMe ? "progress.autoplayMine" : "progress.autoplay") : undefined,
          t("progress.count", { found: s.found.length, cards: s.cards }),
          showTarget ? t("progress.target", { name: targetName }) : undefined,
          s.connected ? undefined : t("progress.disconnected"),
        ]
          .filter(Boolean)
          .join(", ");
        const cls = [styles.chip, s.isMe && styles.mine, !s.connected && styles.offline].filter(Boolean).join(" ");
        return (
          <li key={s.seat} className={cls} data-seat={s.seat} data-offline={s.connected ? undefined : ""} data-autoplay={s.autoplay ? "" : undefined}>
            <span className={styles.srOnly}>{summary}</span>
            <svg viewBox="0 0 100 100" className={styles.pawn} aria-hidden="true">
              <Pawn seat={s.seat} look={s.look} isMe={s.isMe} />
            </svg>
            {(s.isBot || s.autoplay) && <IconRobot size={16} stroke={2} aria-hidden="true" className={styles.botIcon} />}
            <span className={styles.name} aria-hidden="true">
              {s.name}
            </span>
            <span className={styles.count} aria-hidden="true">
              {s.found.length}/{s.cards}
            </span>
            {!s.connected && <IconWifiOff size={16} stroke={2} aria-hidden="true" className={styles.offlineIcon} />}
            {showTarget && (
              <span className={styles.target} data-target={target} aria-hidden="true" title={targetName}>
                <TargetIcon size={20} stroke={2} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
