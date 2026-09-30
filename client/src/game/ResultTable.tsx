import { IconRobot, IconTrophy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ResultRow } from "../session/viewModel.ts";
import styles from "./ResultTable.module.css";
import { SeatMark } from "./SeatMark.tsx";

/**
 * The result of a finished game: every player ranked by score (shared ranks for equal scores), with
 * their colours, the squares on the board and the pieces left; winners get a trophy, a player who left
 * says so. A shared colour comes last, not counted and without a rank.
 */
export function ResultTable({ rows }: { rows: readonly ResultRow[] }) {
  const { t } = useTranslation();
  return (
    <table className={styles.table} aria-label={t("result.label")}>
      <thead>
        <tr>
          <th scope="col">{t("result.rank")}</th>
          <th scope="col" className={styles.player}>
            {t("result.player")}
          </th>
          <th scope="col">{t("result.score")}</th>
          <th scope="col">{t("result.squares")}</th>
          <th scope="col">{t("result.piecesLeft")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.shared ? `shared-${row.colours.join()}` : row.seat}
            className={row.winner ? styles.winner : row.shared ? styles.shared : undefined}
            data-seat={row.seat}
            data-colours={row.colours.join(",")}
            data-rank={row.rank}
          >
            <td className={styles.rank}>{row.shared ? "–" : `${row.rank}.`}</td>
            <th scope="row" className={styles.player}>
              <span className={styles.who}>
                <span className={styles.marks}>
                  {row.colours.map((colour) => (
                    <SeatMark key={colour} seat={colour} isMe={row.isMe} size={16} />
                  ))}
                </span>
                {row.shared ? (
                  <span className={styles.departed}>
                    {t("result.sharedColour")} · {t("result.notCounted")}
                  </span>
                ) : (
                  <span className={row.left ? `${styles.name} ${styles.departed}` : styles.name}>{row.left && !row.name ? t("result.departed") : row.name}</span>
                )}
                {row.isBot && <IconRobot size={14} aria-label={t("progress.bot")} />}
                {row.winner && <IconTrophy size={16} className={styles.trophy} aria-label={t("result.winner")} />}
                {row.left && row.name && <span className={styles.departed}>· {t("result.departed")}</span>}
              </span>
            </th>
            <td>{row.score}</td>
            <td>{row.squares}</td>
            <td>{row.piecesLeft}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
