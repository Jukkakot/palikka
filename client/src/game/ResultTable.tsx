import { IconRobot, IconTrophy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useCountUp } from "../motion/hooks.ts";
import type { ResultRow } from "../session/viewModel.ts";
import styles from "./ResultTable.module.css";
import { SeatMark } from "./SeatMark.tsx";

/**
 * The result of a finished game: every player ranked by score (shared ranks for equal scores), with
 * their colours, the squares on the board and the pieces left; winners get a trophy, a player who left
 * says so. A shared colour comes last, not counted and without a rank. With `celebrate` (a game seen
 * ending with a winner) the scores count up and the winners' rows shimmer once.
 */
export function ResultTable({ rows, celebrate = false }: { rows: readonly ResultRow[]; celebrate?: boolean }) {
  const { t } = useTranslation();
  // Scores may be negative: every count starts from the lowest of them (or 0).
  const from = Math.min(0, ...rows.map((r) => r.score));
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
            className={row.winner ? [styles.winner, celebrate && styles.shimmer].filter(Boolean).join(" ") : row.shared ? styles.shared : undefined}
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
            <ScoreCell score={row.score} run={celebrate} from={from} />
            <td>{row.squares}</td>
            <td>{row.piecesLeft}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A score counting up to its final value; the accessible text holds the final value all along. */
function ScoreCell({ score, run, from }: { score: number; run: boolean; from: number }) {
  const shown = useCountUp(score, run, 900, from);
  if (shown === score) return <td>{score}</td>;
  return (
    <td>
      <span aria-hidden="true">{shown}</span>
      <span className={styles.srOnly}>{score}</span>
    </td>
  );
}
