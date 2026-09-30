import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Placing } from "./usePlacement.ts";

/** Movement (px) that turns a press into a drag; less is a tap. */
export const DRAG_THRESHOLD = 8;
/** For touch, the piece is held this many squares above the finger, so the finger does not hide it. */
export const TOUCH_LIFT = 1.5;

/** Where the dragged piece is drawn: its reference square's centre on screen, and the board's square pitch. */
export interface Floating {
  x: number;
  y: number;
  cell: number;
}

/** The board square (its `data-cell`) at a point on screen, or none. */
function squareAt(x: number, y: number): number | undefined {
  const cell = document.elementFromPoint(x, y)?.closest("[data-board] [data-cell]");
  const value = cell?.getAttribute("data-cell");
  return value == null ? undefined : Number(value);
}

/** The distance from one board square to the next on screen now (square and gap, after any zoom). */
function cellSize(): number {
  const board = document.querySelector("[data-board]");
  if (!board || board.children.length === 0) return 16;
  return board.getBoundingClientRect().width / Math.round(Math.sqrt(board.children.length));
}

/**
 * Dragging pieces with pointer events: from the tray (`fromTray`) or the preview on the board
 * (`fromBoard`). A press that moves more than `DRAG_THRESHOLD` px starts a drag; while dragging, the
 * board square under the piece's reference square is the aim (touch: `TOUCH_LIFT` squares above the
 * finger). Letting go over the board keeps the landing spot; elsewhere the drag is cancelled.
 * `takeClick` tells a click handler to ignore the click that ends a drag.
 */
export function usePieceDrag(placing: Pick<Placing, "dragStart" | "dragTo" | "dragEnd" | "active">) {
  const [floating, setFloating] = useState<Floating>();
  const detach = useRef<() => void>(undefined);
  const justDragged = useRef(false);
  const latest = useRef(placing);
  useEffect(() => {
    latest.current = placing;
  });
  useEffect(() => () => detach.current?.(), []);

  const begin = (down: PointerEvent, piece?: number) => {
    if (!latest.current.active || detach.current || (down.pointerType === "mouse" && down.button !== 0)) return;
    const { pointerId, pointerType } = down;
    const startX = down.clientX;
    const startY = down.clientY;
    let started = false;
    let square: number | undefined;

    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!started) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) <= DRAG_THRESHOLD) return;
        started = true;
        latest.current.dragStart(piece);
      }
      e.preventDefault();
      const cell = cellSize();
      const x = e.clientX;
      const y = pointerType === "mouse" ? e.clientY : e.clientY - TOUCH_LIFT * cell;
      setFloating({ x, y, cell });
      const next = squareAt(x, y);
      if (next !== square) {
        square = next;
        latest.current.dragTo(next);
      }
    };
    const end = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      detach.current?.();
      if (!started) return;
      setFloating(undefined);
      latest.current.dragEnd(e.type === "pointerup" && square !== undefined);
      // The click that follows the release belongs to the drag.
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    detach.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      detach.current = undefined;
    };
  };

  return {
    floating,
    fromTray: (e: PointerEvent, piece: number) => begin(e, piece),
    fromBoard: (e: PointerEvent) => begin(e),
    /** True once for the click that ends a drag: the handler should ignore it. */
    takeClick: () => {
      const was = justDragged.current;
      justDragged.current = false;
      return was;
    },
  };
}
