import { BOARD_SIZE, cellAt, type Board as BoardCells, type Cell } from "@palikka/rules";
import { useTranslation } from "react-i18next";
import styles from "./Board.module.css";

export interface BoardProps {
  board: BoardCells;
  /** Daily puzzle: cells to claim, marked while empty. */
  targets?: readonly number[];
  /** The hint's cell, ringed. */
  hint?: number;
  /** The viewer's own turn: empty cells are buttons that claim the cell. */
  onPlace?(cell: Cell): void;
  /** A command is on its way: the cells stay but do nothing. */
  busy?: boolean;
}

/**
 * The 20×20 board in the Kuura look: flat squares on a frosty ground, a claimed cell in its seat's
 * colour. On the viewer's turn the empty cells are buttons (one tap claims one); otherwise the board
 * is a picture with a text summary for screen readers.
 */
export function Board({ board, targets = [], hint, onPlace, busy = false }: BoardProps) {
  const { t } = useTranslation();
  const targetSet = new Set(targets);
  return (
    <div className={styles.board} role="grid" aria-label={t("board.label")} aria-rowcount={BOARD_SIZE} aria-colcount={BOARD_SIZE} data-board>
      {board.map((owner, i) => {
        const { row, col } = cellAt(i);
        const cls = [styles.cell, owner > 0 && styles.owned, targetSet.has(i) && owner === 0 && styles.target, hint === i && styles.hint]
          .filter(Boolean)
          .join(" ");
        const style = owner > 0 ? { background: `var(--seat-${owner})` } : undefined;
        if (onPlace && owner === 0) {
          return (
            <button
              key={i}
              type="button"
              className={`${cls} ${styles.open}`}
              style={style}
              disabled={busy}
              onClick={() => onPlace({ row, col })}
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
