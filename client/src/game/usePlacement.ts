import { fittingPieces, mirrorOrientation, turnOrientation, type Placement } from "@palikka/rules";
import { useCallback, useMemo, useState } from "react";
import type { GameView } from "../session/viewModel.ts";
import { aimOf, hintMove, previewAt, type Preview } from "./placing.ts";

type PlacementView = Pick<GameView, "position" | "mySeat" | "isMyTurn" | "turn">;

interface State {
  /** The turn the choice belongs to; a new turn drops it. */
  turn: number;
  piece?: number;
  orientation: number;
  square?: number;
  snap: boolean;
}

export interface Placing {
  /** The viewer places now: their turn, and the game has a position. */
  active: boolean;
  /** The pieces that fit somewhere now (on the viewer's turn). */
  fitting?: ReadonlySet<number>;
  /** The chosen piece and its orientation. */
  chosen?: { piece: number; orientation: number };
  /** The chosen piece where it is aimed, once aimed. */
  preview?: Preview;
  /** Tap on a piece: choose it, or clear the choice when it is already chosen. */
  choose(piece: number): void;
  clear(): void;
  turn(): void;
  mirror(): void;
  /** A pointer at a board square: aim there, snapping to a legal spot. */
  point(square: number): void;
  /** A click on a square: the move to send when the square is inside a legal preview, else aims there. */
  click(square: number): Placement | undefined;
  /** Arrow keys: move the aim one square, exactly. */
  moveBy(rows: number, cols: number): void;
  /** "Vihje": the bot's move as the preview. */
  hint(): void;
  /** The move to send for "Aseta" or Enter: the legal preview's. */
  ready?: Placement;
}

/**
 * The piece controls' state for the viewer's turn: the chosen piece, its orientation and the aimed
 * square, and the preview they make. Dropped when the turn changes; `clear` after an accepted move.
 */
export function usePlacement(view: PlacementView): Placing {
  const { position, mySeat, isMyTurn, turn } = view;
  const active = isMyTurn && position !== undefined && mySeat !== undefined;
  const [stored, setState] = useState<State>({ turn, orientation: 0, snap: true });
  // A new turn (or leaving one's turn) starts with nothing chosen.
  const state: State = stored.turn === turn && active ? stored : { turn, orientation: 0, snap: true };
  const update = useCallback(
    (change: (s: State) => State) =>
      setState((prev) => {
        const current = prev.turn === turn ? prev : { turn, orientation: 0, snap: true };
        return change(current);
      }),
    [turn],
  );

  const fitting = useMemo(() => (active ? fittingPieces(position!, mySeat!) : undefined), [active, position, mySeat]);
  const size = position?.config.size ?? 0;
  const preview = useMemo(
    () =>
      active && state.piece !== undefined && state.square !== undefined
        ? previewAt(position!, mySeat!, { piece: state.piece, orientation: state.orientation, square: state.square, snap: state.snap })
        : undefined,
    [active, position, mySeat, state.piece, state.orientation, state.square, state.snap],
  );

  const choose = useCallback(
    (piece: number) => {
      if (!active || !fitting?.has(piece)) return;
      update((s) => (s.piece === piece ? { turn: s.turn, orientation: 0, snap: true } : { ...s, piece, orientation: 0 }));
    },
    [active, fitting, update],
  );
  const clear = useCallback(() => update((s) => ({ turn: s.turn, orientation: 0, snap: true })), [update]);
  const turnPiece = useCallback(
    () => update((s) => (s.piece === undefined ? s : { ...s, orientation: turnOrientation(s.piece, s.orientation) })),
    [update],
  );
  const mirror = useCallback(
    () => update((s) => (s.piece === undefined ? s : { ...s, orientation: mirrorOrientation(s.piece, s.orientation) })),
    [update],
  );
  const point = useCallback(
    (square: number) => {
      if (!active) return;
      update((s) => (s.piece === undefined || (s.square === square && s.snap) ? s : { ...s, square, snap: true }));
    },
    [active, update],
  );
  const click = (square: number): Placement | undefined => {
    if (!active || state.piece === undefined) return undefined;
    if (preview?.legal && preview.squares.includes(square)) return preview.move;
    update((s) => ({ ...s, square, snap: true }));
    return undefined;
  };
  const moveBy = useCallback(
    (rows: number, cols: number) => {
      if (!active) return;
      update((s) => {
        if (s.piece === undefined) return s;
        const start = position!.config.starts[mySeat!]!;
        const from = s.square ?? start.row * size + start.col;
        const row = Math.min(Math.max(Math.floor(from / size) + (s.square === undefined ? 0 : rows), 0), size - 1);
        const col = Math.min(Math.max((from % size) + (s.square === undefined ? 0 : cols), 0), size - 1);
        return { ...s, square: row * size + col, snap: false };
      });
    },
    [active, update, position, mySeat, size],
  );
  const hint = useCallback(() => {
    if (!active) return;
    const move = hintMove(position!, mySeat!, turn);
    if (!move) return;
    update(() => ({ turn, ...aimOf(move, size) }));
  }, [active, position, mySeat, turn, size, update]);

  return {
    active,
    fitting,
    chosen: active && state.piece !== undefined ? { piece: state.piece, orientation: state.orientation } : undefined,
    preview,
    choose,
    clear,
    turn: turnPiece,
    mirror,
    point,
    click,
    moveBy,
    hint,
    ready: preview?.legal ? preview.move : undefined,
  };
}
