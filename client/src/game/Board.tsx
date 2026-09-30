import type { KeyboardEvent, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Board.module.css";

export interface BoardPreview {
  squares: ReadonlySet<number>;
  legal: boolean;
  /** The colour the piece is drawn in. */
  seat: number;
}

export interface BoardProps {
  /** Owner colour per square (0 = empty), row-major; the board is square. */
  board: readonly number[];
  /** Squares marked with a dot: the viewer's free corners on their turn. */
  corners?: ReadonlySet<number>;
  /** The chosen piece where it is aimed. */
  preview?: BoardPreview;
  /** Placing: a mouse over a square (hover preview). */
  onPoint?(square: number): void;
  /** Placing: a click or tap on a square. */
  onSquare?(square: number): void;
  /** Placing: arrow keys. */
  onMove?(rows: number, cols: number): void;
  /** Placing: Enter or Space. */
  onConfirm?(): void;
  /** Spoken description of the preview for screen readers. */
  announce?: string;
  /** A command is on its way: input does nothing. */
  busy?: boolean;
  /** Squares that are not part of the board (the daily puzzle's shape): drawn as bare ground. */
  outside?: ReadonlySet<number>;
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** The board square under a pointer or click target, from its `data-cell`. */
function squareOf(target: EventTarget | null): number | undefined {
  const cell = (target as HTMLElement | null)?.closest?.("[data-cell]");
  const value = cell?.getAttribute("data-cell");
  return value == null ? undefined : Number(value);
}

/**
 * The board in the Kuura look: flat squares on a frosty ground, a placed piece's squares in its
 * colour. While the viewer places a piece, the board takes the pointer (hover and click), the arrow
 * keys and Enter, and shows the chosen piece as a preview: in the seat colour when legal, dashed in
 * the warning colour when not. Free corners of the viewer's colour carry a dot.
 */
export function Board({ board, corners, preview, onPoint, onSquare, onMove, onConfirm, announce, busy = false, outside }: BoardProps) {
  const { t } = useTranslation();
  const size = Math.round(Math.sqrt(board.length));
  const placing = onSquare !== undefined && !busy;

  const pointerMove = (e: PointerEvent) => {
    if (!placing || e.pointerType !== "mouse") return;
    const square = squareOf(e.target);
    if (square !== undefined) onPoint?.(square);
  };
  const keyDown = (e: KeyboardEvent) => {
    if (!placing) return;
    const arrow = ARROWS[e.key];
    if (arrow) {
      e.preventDefault();
      onMove?.(arrow[0], arrow[1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onConfirm?.();
    }
  };

  return (
    <div className={styles.frame}>
      <div
        className={[styles.board, placing && styles.placing, outside && styles.shaped].filter(Boolean).join(" ")}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}
        role="grid"
        aria-label={t("board.label")}
        aria-rowcount={size}
        aria-colcount={size}
        aria-describedby={placing ? "board-announce" : undefined}
        tabIndex={placing ? 0 : undefined}
        onPointerMove={pointerMove}
        onClick={(e) => {
          if (!placing) return;
          const square = squareOf(e.target);
          if (square !== undefined) onSquare(square);
        }}
        onKeyDown={keyDown}
        data-board
      >
        {board.map((owner, i) => {
          const inPreview = preview?.squares.has(i) ?? false;
          const cls = [
            styles.cell,
            corners?.has(i) && owner === 0 && styles.corner,
            inPreview && (preview!.legal ? styles.previewOk : styles.previewBad),
            outside?.has(i) && styles.outside,
          ]
            .filter(Boolean)
            .join(" ");
          const colour = inPreview && preview!.legal ? preview!.seat : owner;
          const style = colour > 0 ? { background: `var(--seat-${colour})` } : undefined;
          return (
            <span
              key={i}
              className={cls}
              style={style}
              data-cell={i}
              data-owner={owner || undefined}
              data-preview={inPreview ? (preview!.legal ? "ok" : "bad") : undefined}
            />
          );
        })}
      </div>
      <p id="board-announce" className={styles.srOnly} aria-live="polite">
        {placing ? announce : ""}
      </p>
    </div>
  );
}
