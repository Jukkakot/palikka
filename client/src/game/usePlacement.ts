import { fittingPieces, freeCorners, type Bits, type Placement } from "@palikka/rules";
import { useCallback, useMemo, useRef, useState } from "react";
import type { GameView } from "../session/viewModel.ts";
import { boardDirection, mirrorOnScreen, turnOnScreen, UNTURNED, type ViewTransform } from "./boardView.ts";
import { aimOf, hintMoves, movesCovering, piecesCovering, previewAt, type Preview } from "./placing.ts";

type PlacementView = Pick<GameView, "position" | "isMyTurn" | "turn"> & Partial<Pick<GameView, "trayColour" | "mySeat" | "turnShared" | "myColours">>;

/** Where the aim stood before a drag, to go back to when the drag is cancelled. */
interface Before {
  piece?: number;
  orientation: number;
  square?: number;
  snap: boolean;
}

interface State {
  /** The turn the choice belongs to; a new turn drops it. */
  turn: number;
  piece?: number;
  orientation: number;
  square?: number;
  snap: boolean;
  /** A drag aims: short-range snapping. */
  near?: boolean;
  /** Corner mode: the free corner (board index) the player tapped. */
  corner?: number;
  /** Corner mode with a piece: which of its spots on the corner is shown. */
  spot?: number;
  /** A drag is going on; the aim before it. */
  drag?: Before;
  /** A drag ended over the board (the status invites the one confirming tap). */
  dropped?: boolean;
  /** How many hints were shown this turn (the last one is `hints - 1` in the list). */
  hints?: number;
  /** How many hints there are this turn. */
  hintCount?: number;
}

const fresh = (turn: number): State => ({ turn, orientation: 0, snap: true });

/** The aim fields of a state, with corner mode, drop and drag cleared. */
const plain = ({ turn, piece, orientation, square, snap, near, hints, hintCount }: State): State => ({ turn, piece, orientation, square, snap, near, hints, hintCount });

/** A state's hint fields, kept across choices within a turn. */
const hintsOf = ({ hints, hintCount }: State) => ({ hints, hintCount });

export interface Placing {
  /** The viewer places now: their turn, and the game has a position. */
  active: boolean;
  /** The pieces that can be chosen now: those that fit somewhere, or in corner mode on the corner. */
  fitting?: ReadonlySet<number>;
  /** The viewer's free corners on their turn (board indexes). */
  corners?: ReadonlySet<number>;
  /** Corner mode: the tapped free corner. */
  corner?: number;
  /** Corner mode with a piece: the shown spot (from 1) and how many there are. */
  spots?: { index: number; count: number };
  /** The chosen piece and its orientation. */
  chosen?: { piece: number; orientation: number };
  /** The chosen piece where it is aimed, once aimed. */
  preview?: Preview;
  /** A piece is being dragged. */
  dragging: boolean;
  /** The last drag ended over the board, and nothing has changed since. */
  dropped: boolean;
  /** After "Vihje": the hint shown (from 1) and how many there are this turn. */
  hints?: { index: number; count: number };
  /** Tap on a piece: choose it, or clear the choice when it is already chosen (in corner mode: leave it). */
  choose(piece: number): void;
  clear(): void;
  turn(): void;
  mirror(): void;
  /** A pointer at a board square: aim there, snapping to a legal spot. */
  point(square: number): void;
  /**
   * A click on a square: the move to send when the square is inside a legal preview. Otherwise a
   * free corner starts (or switches) corner mode, and any other square aims there.
   */
  click(square: number): Placement | undefined;
  /** Arrow keys: move the aim one square, exactly (in screen directions). */
  moveBy(rows: number, cols: number): void;
  /** Corner mode: "‹" (−1) and "›" (+1) through the piece's spots on the corner, wrapping around. */
  step(delta: number): void;
  /** A drag starts: of `piece` from the tray, or of the chosen piece (the preview) without one. */
  dragStart(piece?: number): void;
  /** The drag aims at a board square (the piece's reference square), or is off the board. */
  dragTo(square: number | undefined): void;
  /** The drag ends: over the board the landing spot stays as the preview; elsewhere it is cancelled. */
  dragEnd(overBoard: boolean): void;
  /** "Vihje": the bot's best move as the preview; again: the second and third best, then the best. */
  hint(): void;
  /** The move to send for "Aseta" or Enter: the legal preview's. */
  ready?: Placement;
}

/** The board indexes of a bit set. */
function squaresOfBits(bits: Bits, size: number): Set<number> {
  const squares = new Set<number>();
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if ((bits[r]! >>> c) & 1) squares.add(r * size + c);
  return squares;
}

/**
 * The piece controls' state for the viewer's turn: the chosen piece, its orientation and the aimed
 * square, and the preview they make; corner mode, drags and the hint list. Dropped when the turn
 * changes; `clear` after an accepted move. `transform` is the board view: "Peilaa" and the arrow
 * keys work as seen on screen.
 */
export function usePlacement(view: PlacementView, transform: ViewTransform = UNTURNED): Placing {
  const { position, isMyTurn, turn } = view;
  // The colour the viewer places: the one on turn when it is theirs (the tray's colour).
  const colour = view.trayColour ?? view.mySeat;
  // The hint for the shared colour is chosen for the viewer's own side.
  const viewpoint = view.turnShared ? view.myColours?.find((c) => c !== colour) : undefined;
  const active = isMyTurn && position !== undefined && colour !== undefined;
  const [stored, setState] = useState<State>(fresh(turn));
  // A new turn (or leaving one's turn) starts with nothing chosen.
  const state: State = stored.turn === turn && active ? stored : fresh(turn);
  const update = useCallback((change: (s: State) => State) => setState((prev) => change(prev.turn === turn ? prev : fresh(turn))), [turn]);

  const size = position?.config.size ?? 0;
  const anywhere = useMemo(() => (active ? fittingPieces(position!, colour!) : undefined), [active, position, colour]);
  const corners = useMemo(() => (active ? squaresOfBits(freeCorners(position!, colour!), size) : undefined), [active, position, colour, size]);
  const onCorner = useMemo(
    () => (active && state.corner !== undefined ? piecesCovering(position!, colour!, state.corner) : undefined),
    [active, position, colour, state.corner],
  );
  const fitting = onCorner ?? anywhere;
  const spotList = useMemo(
    () => (onCorner && state.piece !== undefined ? movesCovering(position!, colour!, state.corner!, state.piece) : undefined),
    [onCorner, position, colour, state.corner, state.piece],
  );
  const preview = useMemo(
    () =>
      active && state.piece !== undefined && state.square !== undefined
        ? previewAt(position!, colour!, { piece: state.piece, orientation: state.orientation, square: state.square, snap: state.snap, near: state.near })
        : undefined,
    [active, position, colour, state.piece, state.orientation, state.square, state.snap, state.near],
  );

  /** Corner mode on `corner` with `piece` (or none): its first spot as the preview. One fitting piece is chosen at once. */
  const cornerState = useCallback(
    (s: State, corner: number, piece?: number): State => {
      const pieces = piecesCovering(position!, colour!, corner);
      const only = pieces.size === 1 ? [...pieces][0] : undefined;
      const chosen = piece !== undefined && pieces.has(piece) ? piece : only;
      const base: State = { turn: s.turn, orientation: 0, snap: true, corner, ...hintsOf(s) };
      if (chosen === undefined) return base;
      const [first] = movesCovering(position!, colour!, corner, chosen);
      return { ...base, ...aimOf(first!, size), spot: 0 };
    },
    [position, colour, size],
  );

  const choose = useCallback(
    (piece: number) => {
      if (!active || !fitting?.has(piece)) return;
      update((s) => {
        if (s.corner !== undefined) return s.piece === piece ? plain(s) : cornerState(s, s.corner, piece);
        return s.piece === piece ? { ...fresh(s.turn), ...hintsOf(s) } : { ...plain(s), piece, orientation: 0 };
      });
    },
    [active, fitting, update, cornerState],
  );
  const clear = useCallback(() => update((s) => ({ ...fresh(s.turn), ...hintsOf(s) })), [update]);
  const turnPiece = useCallback(
    () => update((s) => (s.piece === undefined ? s : { ...plain(s), orientation: turnOnScreen(s.piece, s.orientation) })),
    [update],
  );
  const mirror = useCallback(
    () => update((s) => (s.piece === undefined ? s : { ...plain(s), orientation: mirrorOnScreen(s.piece, s.orientation, transform) })),
    [update, transform],
  );
  const point = useCallback(
    (square: number) => {
      if (!active) return;
      // Corner mode and drags aim on their own; hovering does not move their preview.
      update((s) => (s.piece === undefined || s.corner !== undefined || s.drag || (s.square === square && s.snap && !s.near) ? s : { ...plain(s), square, snap: true }));
    },
    [active, update],
  );
  const click = (square: number): Placement | undefined => {
    if (!active) return undefined;
    if (state.piece !== undefined && preview?.legal && preview.squares.includes(square)) return preview.move;
    if (corners?.has(square) && (state.piece === undefined || state.corner !== undefined)) {
      update((s) => cornerState(s, square, s.piece));
      return undefined;
    }
    if (state.piece === undefined) {
      if (state.corner !== undefined) update((s) => plain(s));
      return undefined;
    }
    update((s) => ({ ...plain(s), square, snap: true }));
    return undefined;
  };
  const moveBy = useCallback(
    (rows: number, cols: number) => {
      if (!active) return;
      const [dr, dc] = boardDirection(rows, cols, transform);
      update((s) => {
        if (s.piece === undefined) return s;
        const start = position!.config.starts[colour!]!;
        const from = s.square ?? start.row * size + start.col;
        const row = Math.min(Math.max(Math.floor(from / size) + (s.square === undefined ? 0 : dr), 0), size - 1);
        const col = Math.min(Math.max((from % size) + (s.square === undefined ? 0 : dc), 0), size - 1);
        return { ...plain(s), square: row * size + col, snap: false, near: false };
      });
    },
    [active, update, position, colour, size, transform],
  );
  const step = useCallback(
    (delta: number) => {
      if (!spotList || spotList.length === 0) return;
      update((s) => {
        if (s.corner === undefined || s.piece === undefined) return s;
        const spot = (((s.spot ?? 0) + delta) % spotList.length + spotList.length) % spotList.length;
        return { ...s, ...aimOf(spotList[spot]!, size), spot, dropped: false };
      });
    },
    [spotList, update, size],
  );

  const dragStart = useCallback(
    (piece?: number) => {
      if (!active) return;
      if (piece !== undefined && !anywhere?.has(piece)) return;
      update((s) => {
        const chosen = piece ?? s.piece;
        if (chosen === undefined) return s;
        const before: Before = { piece: s.piece, orientation: s.orientation, square: s.square, snap: s.snap };
        const orientation = chosen === s.piece ? s.orientation : 0;
        return { turn: s.turn, piece: chosen, orientation, square: chosen === s.piece ? s.square : undefined, snap: true, near: true, drag: before, ...hintsOf(s) };
      });
    },
    [active, anywhere, update],
  );
  const dragTo = useCallback(
    (square: number | undefined) => {
      update((s) => {
        if (!s.drag || s.square === square) return s;
        return { ...s, square, snap: true, near: true };
      });
    },
    [update],
  );
  const dragEnd = useCallback(
    (overBoard: boolean) => {
      update((s) => {
        if (!s.drag) return s;
        if (overBoard && s.square !== undefined) return { ...plain(s), dropped: true };
        // Cancelled: the piece stays chosen; the preview goes back to where it was, or none.
        const back = s.drag.piece === s.piece ? s.drag : { orientation: s.orientation, snap: true };
        return { turn: s.turn, piece: s.piece, orientation: back.orientation, square: back.square, snap: back.snap, ...hintsOf(s) };
      });
    },
    [update],
  );

  // The hint list is computed once per turn and position (it is the slow part), on the first press.
  const hintCache = useRef<{ key: unknown[]; moves: Placement[] }>(undefined);
  const hint = useCallback(() => {
    if (!active) return;
    const key = [position, colour, turn, viewpoint];
    const cached = hintCache.current;
    const moves = cached && cached.key.every((k, i) => k === key[i]) ? cached.moves : hintMoves(position!, colour!, turn, viewpoint);
    hintCache.current = { key, moves };
    if (moves.length === 0) return;
    update((s) => {
      const hints = ((s.hints ?? 0) % moves.length) + 1;
      return { turn, ...aimOf(moves[hints - 1]!, size), hints, hintCount: moves.length };
    });
  }, [active, position, colour, turn, size, update, viewpoint]);

  const spot = state.spot ?? 0;
  return {
    active,
    fitting,
    corners,
    corner: active ? state.corner : undefined,
    spots: spotList && spotList.length > 0 ? { index: spot + 1, count: spotList.length } : undefined,
    chosen: active && state.piece !== undefined ? { piece: state.piece, orientation: state.orientation } : undefined,
    preview,
    dragging: active && state.drag !== undefined,
    dropped: active && state.dropped === true,
    hints: active && state.hints !== undefined && state.hintCount ? { index: state.hints, count: state.hintCount } : undefined,
    choose,
    clear,
    turn: turnPiece,
    mirror,
    point,
    click,
    moveBy,
    step,
    dragStart,
    dragTo,
    dragEnd,
    hint,
    ready: preview?.legal ? preview.move : undefined,
  };
}
