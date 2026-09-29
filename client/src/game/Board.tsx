import { useTranslation } from "react-i18next";
import styles from "./Board.module.css";

export interface BoardProps {
  /** Owner colour per square (0 = empty), row-major; the board is square. */
  board: readonly number[];
  /** Squares ringed as the hint. */
  hint?: ReadonlySet<number>;
  /** The viewer's turn: the squares they can tap (interim move control). */
  tappable?: ReadonlySet<number>;
  onTap?(index: number): void;
  /** A command is on its way: the squares stay but do nothing. */
  busy?: boolean;
}

/**
 * The board in the Kuura look: flat squares on a frosty ground, a placed piece's squares in its
 * colour. On the viewer's turn the squares where a piece of theirs fits are marked buttons (one tap
 * places a piece there); otherwise the board is a picture.
 */
export function Board({ board, hint, tappable, onTap, busy = false }: BoardProps) {
  const { t } = useTranslation();
  const size = Math.round(Math.sqrt(board.length));
  return (
    <div
      className={styles.board}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label={t("board.label")}
      aria-rowcount={size}
      aria-colcount={size}
      data-board
    >
      {board.map((owner, i) => {
        const row = Math.floor(i / size);
        const col = i % size;
        const cls = [styles.cell, owner > 0 && styles.owned, hint?.has(i) && styles.hint].filter(Boolean).join(" ");
        const style = owner > 0 ? { background: `var(--seat-${owner})` } : undefined;
        if (onTap && tappable?.has(i)) {
          return (
            <button
              key={i}
              type="button"
              className={`${cls} ${styles.open}`}
              disabled={busy}
              onClick={() => onTap(i)}
              aria-label={t("board.cell", { row: row + 1, col: col + 1 })}
              data-cell={i}
            />
          );
        }
        return <span key={i} className={cls} style={style} data-cell={i} data-owner={owner || undefined} />;
      })}
    </div>
  );
}
