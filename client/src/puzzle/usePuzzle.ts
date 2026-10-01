import { dailyPuzzle, mirrorOrientation, puzzleSolved, turnOrientation, type Placement, type Puzzle } from "@palikka/rules";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aimOf } from "../game/placing.ts";
import { log } from "@game-kit/client";
import { placementAt, puzzleColours, puzzlePreviewAt, type PuzzlePreview } from "./puzzlePlacing.ts";
import { loadPuzzleSave, progressFor, recordSolve, resultFor, savePuzzle, type PuzzleResult } from "./puzzleStore.ts";

interface Choice {
  piece?: number;
  orientation: number;
  square?: number;
  snap: boolean;
}

const NOTHING: Choice = { orientation: 0, snap: true };

export interface PuzzleSession {
  puzzle: Puzzle;
  placements: readonly Placement[];
  /** Owner colour per board square, for the board. */
  owner: number[];
  /** Board squares outside the shape. */
  outside: ReadonlySet<number>;
  chosen?: { piece: number; orientation: number };
  preview?: PuzzlePreview;
  /** The move for "Aseta" or Enter: the fitting preview's. */
  ready?: Placement;
  elapsedMs: number;
  /** Set once solved. */
  result?: PuzzleResult;
  choose(piece: number): void;
  turn(): void;
  mirror(): void;
  point(square: number): void;
  /** A click on a square: places a fitting preview under it, lifts a placed piece, or aims there. */
  click(square: number): void;
  moveBy(rows: number, cols: number): void;
  place(): void;
  clear(): void;
  /** Saves the time so far (closing the screen). */
  save(): void;
}

export interface PuzzleOptions {
  date: string;
  now?: () => number;
  /** Page visibility; the clock runs only while visible. */
  visible?: () => boolean;
  store?: Storage;
}

const pageVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

/**
 * The daily puzzle's state: the pieces on the board, the chosen piece and its aim, the clock (running
 * while the screen is open, the page visible and the puzzle unsolved) and saving to the device.
 */
export function usePuzzle({ date, now = Date.now, visible = pageVisible, store }: PuzzleOptions): PuzzleSession {
  const puzzle = useMemo(() => dailyPuzzle(date), [date]);
  const [initial] = useState(() => {
    const save = loadPuzzleSave(store);
    return { progress: progressFor(save, date), result: resultFor(save, date) };
  });
  const [placements, setPlacements] = useState<readonly Placement[]>(initial.progress.placements);
  const [choice, setChoice] = useState<Choice>(NOTHING);
  const [result, setResult] = useState(initial.result);
  const solved = result !== undefined;

  // Clock: `base` ms counted so far, plus the running stretch since `since` (undefined = stopped).
  const clock = useRef({ base: initial.result?.ms ?? initial.progress.elapsedMs, since: undefined as number | undefined });
  const [elapsedMs, setElapsedMs] = useState(initial.result?.ms ?? initial.progress.elapsedMs);
  const placementsRef = useRef(placements);
  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);
  const elapsed = useCallback(() => clock.current.base + (clock.current.since === undefined ? 0 : now() - clock.current.since), [now]);
  const stop = useCallback(() => {
    clock.current = { base: elapsed(), since: undefined };
  }, [elapsed]);

  const persist = useCallback(
    (list: readonly Placement[]) => {
      const save = loadPuzzleSave(store);
      savePuzzle({ ...save, progress: { date, placements: [...list], elapsedMs: elapsed() } }, store);
    },
    [date, elapsed, store],
  );

  useEffect(() => {
    if (solved) return;
    const run = () => {
      if (visible()) {
        if (clock.current.since === undefined) clock.current.since = now();
      } else if (clock.current.since !== undefined) {
        stop();
        persist(placementsRef.current);
      }
    };
    run();
    const timer = setInterval(() => {
      run();
      setElapsedMs(elapsed());
    }, 1000);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      stop();
    };
  }, [solved, visible, now, stop, persist, elapsed]);

  const commit = (list: readonly Placement[]) => {
    setPlacements(list);
    if (puzzleSolved(puzzle, list)) {
      stop();
      const ms = clock.current.base;
      setElapsedMs(ms);
      const save = recordSolve({ ...loadPuzzleSave(store), progress: { date, placements: [...list], elapsedMs: ms } }, date, puzzle.pieces.length, ms);
      savePuzzle(save, store);
      setResult(save.result);
      log.info("client.puzzle.solved", { date, pieces: puzzle.pieces.length, seconds: Math.round(ms / 1000) });
    } else {
      persist(list);
    }
  };

  const active = !solved;
  const preview = useMemo(
    () =>
      active && choice.piece !== undefined && choice.square !== undefined
        ? puzzlePreviewAt(puzzle, placements, { piece: choice.piece, orientation: choice.orientation, square: choice.square, snap: choice.snap })
        : undefined,
    [active, puzzle, placements, choice],
  );
  const ready = preview?.legal ? preview.move : undefined;
  const used = new Set(placements.map((p) => p.piece));

  const placeMove = (move: Placement) => {
    commit([...placements, move]);
    setChoice(NOTHING);
  };

  return {
    puzzle,
    placements,
    owner: useMemo(() => puzzleColours(puzzle, placements), [puzzle, placements]),
    outside: useMemo(() => {
      const shape = new Set(puzzle.shape);
      return new Set(Array.from({ length: puzzle.size ** 2 }, (_, i) => i).filter((i) => !shape.has(i)));
    }, [puzzle]),
    chosen: active && choice.piece !== undefined ? { piece: choice.piece, orientation: choice.orientation } : undefined,
    preview,
    ready,
    elapsedMs,
    result,
    choose(piece) {
      if (!active || used.has(piece) || !puzzle.pieces.includes(piece)) return;
      setChoice((c) => (c.piece === piece ? NOTHING : { ...c, piece, orientation: 0 }));
    },
    turn() {
      setChoice((c) => (c.piece === undefined ? c : { ...c, orientation: turnOrientation(c.piece, c.orientation) }));
    },
    mirror() {
      setChoice((c) => (c.piece === undefined ? c : { ...c, orientation: mirrorOrientation(c.piece, c.orientation) }));
    },
    point(square) {
      if (!active) return;
      setChoice((c) => (c.piece === undefined || (c.square === square && c.snap) ? c : { ...c, square, snap: true }));
    },
    click(square) {
      if (!active) return;
      if (preview?.legal && preview.squares.includes(square)) return placeMove(preview.move);
      const placed = placementAt(puzzle, placements, square);
      if (placed) {
        commit(placements.filter((p) => p !== placed));
        setChoice(aimOf(placed, puzzle.size));
        return;
      }
      if (choice.piece !== undefined) setChoice((c) => ({ ...c, square, snap: true }));
    },
    moveBy(rows, cols) {
      if (!active) return;
      setChoice((c) => {
        if (c.piece === undefined) return c;
        const size = puzzle.size;
        const from = c.square ?? puzzle.shape[0]!;
        const step = c.square === undefined ? 0 : 1;
        const row = Math.min(Math.max(Math.floor(from / size) + rows * step, 0), size - 1);
        const col = Math.min(Math.max((from % size) + cols * step, 0), size - 1);
        return { ...c, square: row * size + col, snap: false };
      });
    },
    place() {
      if (active && ready) placeMove(ready);
    },
    clear() {
      if (!active || placements.length === 0) return;
      commit([]);
      setChoice(NOTHING);
    },
    save() {
      if (!solved) persist(placements);
    },
  };
}
