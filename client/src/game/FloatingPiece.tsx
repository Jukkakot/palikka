import { referenceCell } from "./placing.ts";
import { screenCell, UNTURNED, type ViewTransform } from "./boardView.ts";
import styles from "./FloatingPiece.module.css";
import { PieceShape } from "./PieceShape.tsx";
import type { Floating } from "./usePieceDrag.ts";

export interface FloatingPieceProps {
  at: Floating;
  piece: number;
  /** Board orientation; drawn as it looks on the (turned) board. */
  orientation: number;
  seat: number;
  /** The landing spot is legal: full colour; else faded with a dashed warning outline. */
  legal: boolean;
  view?: ViewTransform;
}

/**
 * The piece that follows the pointer while it is dragged, the size of the board's squares, held by
 * its reference square (which `at` places). It never takes pointer events, so the board under it
 * is what the drag aims at.
 */
export function FloatingPiece({ at, piece, orientation, seat, legal, view = UNTURNED }: FloatingPieceProps) {
  const shown = screenCell(piece, orientation, referenceCell(piece, orientation), view);
  const cell = Math.max(at.cell - 1, 4);
  const pitch = cell + 1;
  return (
    <div
      className={legal ? styles.floating : `${styles.floating} ${styles.bad}`}
      style={{ left: at.x - (shown.ref[1] + 0.5) * pitch, top: at.y - (shown.ref[0] + 0.5) * pitch }}
      data-floating={legal ? "ok" : "bad"}
      aria-hidden="true"
    >
      <PieceShape piece={piece} orientation={shown.orientation} seat={seat} cell={cell} />
    </div>
  );
}
