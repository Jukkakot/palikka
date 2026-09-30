import { PIECE_COUNT, PIECE_IDS, PIECE_SIZES } from "@palikka/rules";
import { useTranslation } from "react-i18next";
import { PieceShape } from "./PieceShape.tsx";
import styles from "./PieceTray.module.css";

export interface PieceTrayProps {
  /** The viewer's colour. */
  seat: number;
  /** Pieces already on the board: their slots are empty. */
  placed: readonly number[];
  /** On the viewer's turn, the pieces that fit somewhere; undefined off turn (nothing selectable). */
  fitting?: ReadonlySet<number>;
  chosen?: { piece: number; orientation: number };
  onChoose(piece: number): void;
  disabled?: boolean;
  /** Only these pieces have slots (the daily puzzle's set); default all 21. */
  pieces?: readonly number[];
}

const ALL = Array.from({ length: PIECE_COUNT }, (_, piece) => piece);

/**
 * The viewer's 21 pieces in their colour, in fixed slots (smallest first), so each piece is always in
 * the same place. A placed piece leaves its slot empty; on the viewer's turn the pieces that fit
 * nowhere are dimmed and cannot be chosen; the chosen one shows its current orientation.
 */
export function PieceTray({ seat, placed, fitting, chosen, onChoose, disabled = false, pieces = ALL }: PieceTrayProps) {
  const { t } = useTranslation();
  const used = new Set(placed);
  return (
    <ul className={styles.tray} aria-label={t("tray.label")}>
      {pieces.map((piece) => {
        if (used.has(piece)) return <li key={piece} className={styles.slot} data-piece={PIECE_IDS[piece]} data-placed="" />;
        const fits = fitting?.has(piece) ?? false;
        const isChosen = chosen?.piece === piece;
        const cls = [styles.piece, isChosen && styles.chosen, fitting && !fits && styles.dim].filter(Boolean).join(" ");
        return (
          <li key={piece} className={styles.slot} data-piece={PIECE_IDS[piece]}>
            <button
              type="button"
              className={cls}
              disabled={disabled || !fits}
              aria-pressed={isChosen}
              aria-label={t("tray.piece", { id: PIECE_IDS[piece], count: PIECE_SIZES[piece] })}
              onClick={() => onChoose(piece)}
            >
              <PieceShape piece={piece} orientation={isChosen ? chosen.orientation : 0} seat={seat} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
