import { PIECE_COUNT, PIECE_IDS, PIECE_SIZES } from "@palikka/rules";
import { useMemo, type CSSProperties, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { usePrevious } from "../motion/hooks.ts";
import { screenOrientation, UNTURNED, type ViewTransform } from "./boardView.ts";
import { PieceShape } from "./PieceShape.tsx";
import styles from "./PieceTray.module.css";
import { newlyFrozen, newlyPlaced, sameTray, type TraySnapshot } from "./trayMotion.ts";

export interface PieceTrayProps {
  /** The viewer's colour. */
  seat: number;
  /** Pieces already on the board: their slots are empty. */
  placed: readonly number[];
  /** The pieces that can be chosen now (on the viewer's turn); undefined off turn (nothing selectable). */
  fitting?: ReadonlySet<number>;
  /** The pieces that fit somewhere on the board, on and off turn; the others are shown frozen. */
  fitsAnywhere?: ReadonlySet<number>;
  chosen?: { piece: number; orientation: number };
  onChoose(piece: number): void;
  disabled?: boolean;
  /** Only these pieces have slots (the daily puzzle's set); default all 21. */
  pieces?: readonly number[];
  /** A pointer pressed on a selectable piece (a drag may start). */
  onDragStart?(e: PointerEvent, piece: number): void;
  /** The board's view: pieces are drawn as they will lie on the turned board. */
  view?: ViewTransform;
}

const ALL = Array.from({ length: PIECE_COUNT }, (_, piece) => piece);

/**
 * The viewer's 21 pieces in their colour, in fixed slots (smallest first), so each piece is always in
 * the same place. A placed piece's slot fades out and stays empty. A piece that fits nowhere on the
 * board is frozen (frosted, not in the colour) on and off turn, and freezes with a short animation
 * when another move takes its last spot; in corner mode the pieces that do not fit on the corner are
 * dimmed. The chosen one shows its current orientation. A fitting piece can also be dragged onto the
 * board.
 */
export function PieceTray({ seat, placed, fitting, fitsAnywhere, chosen, onChoose, disabled = false, pieces = ALL, onDragStart, view = UNTURNED }: PieceTrayProps) {
  const { t } = useTranslation();
  const used = useMemo(() => new Set(placed), [placed]);
  const snapshot: TraySnapshot = { colour: seat, fits: fitsAnywhere, placed: used };
  const before = usePrevious(snapshot, sameTray);
  const freezing = newlyFrozen(before, snapshot);
  const leaving = newlyPlaced(before, snapshot);
  return (
    <ul className={styles.tray} aria-label={t("tray.label")}>
      {pieces.map((piece) => {
        if (used.has(piece))
          return (
            <li key={piece} className={styles.slot} data-piece={PIECE_IDS[piece]} data-placed="">
              {leaving.has(piece) && (
                <span className={styles.gone} aria-hidden="true">
                  <PieceShape piece={piece} orientation={screenOrientation(piece, 0, view)} seat={seat} />
                </span>
              )}
            </li>
          );
        const frozen = fitsAnywhere !== undefined && !fitsAnywhere.has(piece);
        const fits = !frozen && (fitting?.has(piece) ?? false);
        const isChosen = chosen?.piece === piece;
        const draggable = onDragStart !== undefined && fits && !disabled;
        const cls = [
          styles.piece,
          isChosen && styles.chosen,
          frozen && styles.frozen,
          frozen && freezing.has(piece) && styles.freeze,
          !frozen && fitting && !fits && styles.dim,
          draggable && styles.draggable,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={piece} className={styles.slot} data-piece={PIECE_IDS[piece]} data-frozen={frozen ? "" : undefined}>
            <button
              type="button"
              className={cls}
              style={{ "--piece-colour": `var(--seat-${seat})` } as CSSProperties}
              disabled={disabled || !fits}
              aria-pressed={isChosen}
              aria-label={t("tray.piece", { id: PIECE_IDS[piece], count: PIECE_SIZES[piece] })}
              onClick={() => onChoose(piece)}
              onPointerDown={draggable ? (e) => onDragStart(e, piece) : undefined}
            >
              <PieceShape
                piece={piece}
                orientation={screenOrientation(piece, isChosen ? chosen.orientation : 0, view)}
                seat={seat}
                fill={frozen ? "var(--frost)" : undefined}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
