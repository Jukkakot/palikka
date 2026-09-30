import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useBlip } from "../motion/hooks.ts";
import styles from "./Board.module.css";
import { toBoard, UNTURNED, type ViewTransform, type ZoomBox } from "./boardView.ts";

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
  /** Corner mode: the tapped free corner, marked more strongly. */
  corner?: number;
  /** The chosen piece where it is aimed. */
  preview?: BoardPreview;
  /** Placing: a mouse over a square (hover preview). */
  onPoint?(square: number): void;
  /** Placing: a click or tap on a square. */
  onSquare?(square: number): void;
  /** Placing: arrow keys (screen directions). */
  onMove?(rows: number, cols: number): void;
  /** Placing: Enter or Space. */
  onConfirm?(): void;
  /** Placing: a pointer pressed on the preview (a drag may start). */
  onPreviewPointerDown?(e: PointerEvent): void;
  /** Spoken description of the preview for screen readers. */
  announce?: string;
  /** A command is on its way: input does nothing. */
  busy?: boolean;
  /** Squares that are not part of the board (the daily puzzle's shape): drawn as bare ground. */
  outside?: ReadonlySet<number>;
  /** How the board is turned on screen; squares are still reported as board indexes. */
  view?: ViewTransform;
  /** The part of the board shown enlarged (screen space); the whole board without it. */
  zoom?: ZoomBox;
  /** A piece is being dragged: the board takes all touch movement (no page scrolling). */
  dragging?: boolean;
  /** The squares the last move filled: marked with a ring and a small square (static). */
  lastMove?: ReadonlySet<number>;
  /** Newly filled squares: they settle into place with a short animation. */
  fresh?: ReadonlySet<number>;
  /** Changes on a refused placing attempt: the preview shakes. */
  shake?: number;
  /** Changes when a hint is shown: the preview pulses once. */
  pulse?: number;
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
 * The zoom as a transform of the grid: scaled so the box fills the frame, moved so its top-left
 * square is at the frame's corner (2 px of padding, and the grid's 2 px gaps spread over the squares).
 */
function zoomStyle(zoom: ZoomBox | undefined, size: number): CSSProperties | undefined {
  if (!zoom) return undefined;
  const shift = (n: number) => `calc(-2px - ${n} * (100% - 2px) / ${size})`;
  return { transform: `scale(${size / zoom.span}) translate(${shift(zoom.col)}, ${shift(zoom.row)})` };
}

/**
 * The board in the Kuura look: flat squares on a frosty ground, a placed piece's squares in its
 * colour. While the viewer places a piece, the board takes the pointer (hover and click), the arrow
 * keys and Enter, and shows the chosen piece as a preview: in the seat colour when legal, dashed in
 * the warning colour when not. Free corners of the viewer's colour carry a dot. On a phone the board
 * may be turned (`view`) and zoomed to a part of it (`zoom`); the squares it reports are always
 * board indexes.
 */
export function Board(props: BoardProps) {
  const { board, corners, corner, preview, onPoint, onSquare, onMove, onConfirm, onPreviewPointerDown, announce, busy = false, outside } = props;
  const { view = UNTURNED, zoom, dragging = false, lastMove, fresh, shake, pulse } = props;
  const { t } = useTranslation();
  // A shake or pulse runs on the preview squares of that moment only (not on a preview moved later).
  const shaking = useBlip(shake, 200);
  const pulsing = useBlip(pulse, 250);
  const previewMotion =
    shaking !== undefined ? styles[shaking % 2 ? "shakeA" : "shakeB"] : pulsing !== undefined ? styles[pulsing % 2 ? "pulseA" : "pulseB"] : undefined;
  const size = Math.round(Math.sqrt(board.length));
  const placing = onSquare !== undefined && !busy;

  const pointerMove = (e: PointerEvent) => {
    if (!placing || e.pointerType !== "mouse" || dragging) return;
    const square = squareOf(e.target);
    if (square !== undefined) onPoint?.(square);
  };
  const pointerDown = (e: PointerEvent) => {
    if (!placing || !onPreviewPointerDown) return;
    const square = squareOf(e.target);
    if (square !== undefined && preview?.squares.has(square)) onPreviewPointerDown(e);
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
    <div className={[styles.frame, zoom && styles.zoomed].filter(Boolean).join(" ")} data-zoom={zoom ? `${zoom.row},${zoom.col},${zoom.span}` : undefined}>
      <div
        className={[styles.board, placing && styles.placing, outside && styles.shaped, dragging && styles.dragging].filter(Boolean).join(" ")}
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)`, ...zoomStyle(zoom, size) }}
        role="grid"
        aria-label={t("board.label")}
        aria-rowcount={size}
        aria-colcount={size}
        aria-describedby={placing ? "board-announce" : undefined}
        tabIndex={placing ? 0 : undefined}
        onPointerMove={pointerMove}
        onPointerDown={pointerDown}
        onClick={(e) => {
          if (!placing) return;
          const square = squareOf(e.target);
          if (square !== undefined) onSquare(square);
        }}
        onKeyDown={keyDown}
        data-board
        data-turns={view.turns || undefined}
      >
        {board.map((_, screen) => {
          const i = toBoard(screen, size, view);
          const owner = board[i]!;
          const inPreview = preview?.squares.has(i) ?? false;
          const cls = [
            styles.cell,
            corners?.has(i) && owner === 0 && styles.corner,
            corner === i && styles.cornerOn,
            inPreview && (preview!.legal ? styles.previewOk : styles.previewBad),
            inPreview && onPreviewPointerDown && styles.handle,
            inPreview && previewMotion,
            !inPreview && owner !== 0 && lastMove?.has(i) && styles.last,
            !inPreview && owner !== 0 && fresh?.has(i) && styles.settle,
            outside?.has(i) && styles.outside,
          ]
            .filter(Boolean)
            .join(" ");
          const colour = inPreview && preview!.legal ? preview!.seat : owner;
          const style = colour > 0 ? { backgroundColor: `var(--seat-${colour})` } : undefined;
          return (
            <span
              key={i}
              className={cls}
              style={style}
              data-cell={i}
              data-owner={owner || undefined}
              data-preview={inPreview ? (preview!.legal ? "ok" : "bad") : undefined}
              data-last={!inPreview && owner !== 0 && lastMove?.has(i) ? "" : undefined}
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
