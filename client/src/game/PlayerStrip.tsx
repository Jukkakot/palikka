import { IconRobot, IconWifiOff } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { usePrevious } from "../motion/hooks.ts";
import type { GameView } from "../session/viewModel.ts";
import styles from "./PlayerStrip.module.css";
import { SeatMark } from "./SeatMark.tsx";

/**
 * One chip per seat: the seat's colour or colours, the nickname (shortened with an ellipsis; the full name is in
 * the accessible text) and the score (the rules' points), a struck-through score once the colour
 * cannot move any more on a frosted chip (it freezes with a short animation when seen going out), and
 * a dimmed chip with an icon when disconnected. The seat on turn has a bar under its chip. A bot's chip has a robot icon, and so does a person's while the bot plays for them.
 */
export function PlayerStrip({ view }: { view: Pick<GameView, "seats"> & Partial<Pick<GameView, "turnSeat" | "turnColour" | "finished">> }) {
  const { t } = useTranslation();
  const onTurn = view.finished ? undefined : view.turnSeat || undefined;
  // Seats seen going out while shown freeze; those already out at first sight are just frosted.
  const outList = view.seats.filter((s) => s.out).map((s) => s.seat).join(",");
  const outBefore = usePrevious(outList);
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
        const freezing = s.out && outBefore !== undefined && !outBefore.split(",").includes(String(s.seat));
        const turn = s.seat === onTurn;
        const cls = [styles.chip, s.isMe && styles.mine, !s.connected && styles.offline, s.out && styles.out, freezing && styles.freeze, turn && styles.turn]
          .filter(Boolean)
          .join(" ");
        const style = turn ? ({ "--turn-colour": `var(--seat-${view.turnColour || s.seat})` } as CSSProperties) : undefined;
        return (
          <li key={s.seat} className={cls} style={style} data-seat={s.seat} data-turn={turn ? "" : undefined} data-freeze={freezing ? "" : undefined} data-offline={s.connected ? undefined : ""} data-autoplay={s.autoplay ? "" : undefined} data-out={s.out ? "" : undefined}>
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
