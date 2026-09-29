import { emptyBits, setBit, type Bits } from "./bitboard.js";
import type { BoardConfig } from "./config.js";
import type { Placement } from "./moves.js";
import { ORIENTATIONS, PIECE_COUNT } from "./pieces.js";

/**
 * The engine's game state, plain JSON so it syncs, saves and replays. Treated as immutable:
 * every change returns a new position.
 */
export interface Position {
  readonly config: BoardConfig;
  /** Colours in this game, ascending. */
  readonly colours: readonly number[];
  /** Owner colour per square (0 = empty), row-major. */
  readonly cells: readonly number[];
  /** Placed piece numbers per colour, in placement order. */
  readonly placed: Readonly<Record<number, readonly number[]>>;
  /** Colours that are out (stuck or all pieces placed), in the order they went out. */
  readonly out: readonly number[];
  /** Colour on turn; 0 once the game has ended. */
  readonly turn: number;
  /** Pieces placed so far by all colours. */
  readonly moveNumber: number;
  readonly ended: boolean;
  /** Ended from outside, with no winner. */
  readonly aborted: boolean;
}

/** Why a placement or another action was refused. */
export type MoveRefusal =
  | "INVALID_MOVE"
  | "PIECE_USED"
  | "OFF_BOARD"
  | "OVERLAP"
  | "EDGE_CONTACT"
  | "NOT_ON_START"
  | "NO_CORNER_CONTACT"
  | "NOT_YOUR_TURN"
  | "GAME_OVER"
  | "CANNOT_PASS";

export function newPosition(config: BoardConfig, colours: readonly number[], first: number): Position {
  const sorted = [...new Set(colours)].sort((a, b) => a - b);
  for (const colour of sorted) {
    if (!config.starts[colour]) throw new RangeError(`Colour ${colour} has no start square`);
  }
  if (!sorted.includes(first)) throw new RangeError(`First colour ${first} is not in the game`);
  const placed: Record<number, number[]> = {};
  for (const colour of sorted) placed[colour] = [];
  return {
    config,
    colours: sorted,
    cells: new Array<number>(config.size * config.size).fill(0),
    placed,
    out: [],
    turn: first,
    moveNumber: 0,
    ended: false,
    aborted: false,
  };
}

/** Bitboards of a position, rebuilt from `cells` and cached per position object. */
export interface BitView {
  readonly occupied: Bits;
  readonly own: Readonly<Record<number, Bits>>;
  /** 1 per placed piece number, per colour. */
  readonly used: Readonly<Record<number, Uint8Array>>;
}

const views = new WeakMap<Position, BitView>();

export function bitView(position: Position): BitView {
  let view = views.get(position);
  if (!view) {
    view = buildView(position);
    views.set(position, view);
  }
  return view;
}

function buildView(position: Position): BitView {
  const { size } = position.config;
  const occupied = emptyBits(size);
  const own: Record<number, Bits> = {};
  const used: Record<number, Uint8Array> = {};
  for (const colour of position.colours) {
    own[colour] = emptyBits(size);
    used[colour] = new Uint8Array(PIECE_COUNT);
    for (const piece of position.placed[colour] ?? []) used[colour][piece] = 1;
  }
  position.cells.forEach((owner, index) => {
    if (owner === 0) return;
    const row = Math.floor(index / size);
    const col = index % size;
    setBit(occupied, row, col);
    const bits = own[owner];
    if (bits) setBit(bits, row, col);
  });
  return { occupied, own, used };
}

/** The view after `colour` places `placement` on `view` (a copy; the input is untouched). */
export function viewWith(view: BitView, colour: number, placement: Placement): BitView {
  const orientation = ORIENTATIONS[placement.piece]![placement.orientation]!;
  const occupied = view.occupied.slice();
  const bits = view.own[colour]!.slice();
  orientation.rows.forEach((mask, i) => {
    occupied[placement.row + i]! |= mask << placement.col;
    bits[placement.row + i]! |= mask << placement.col;
  });
  const used = view.used[colour]!.slice();
  used[placement.piece] = 1;
  return { occupied, own: { ...view.own, [colour]: bits }, used: { ...view.used, [colour]: used } };
}

export function rememberView(position: Position, view: BitView): void {
  views.set(position, view);
}

/**
 * The same position with `colour` on turn (bots ask for and try out moves of a colour that is not
 * on turn). Carries the cached bitboards over, so they are not rebuilt.
 */
export function withTurn(position: Position, colour: number): Position {
  if (position.turn === colour) return position;
  const next: Position = { ...position, turn: colour };
  const view = views.get(position);
  if (view) views.set(next, view);
  return next;
}

function isIndex(value: unknown, below: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < below;
}

/**
 * Checks one placement for `colour`, ignoring whose turn it is. Returns the single refusal reason
 * in the spec's order, or undefined when the placement is legal.
 */
export function checkPlacement(position: Position, colour: number, placement: Placement): MoveRefusal | undefined {
  const { size, starts } = position.config;
  const { piece, orientation: index, row, col } = placement;
  if (!position.colours.includes(colour) || !isIndex(piece, PIECE_COUNT)) return "INVALID_MOVE";
  const orientations = ORIENTATIONS[piece]!;
  if (!isIndex(index, orientations.length) || !Number.isInteger(row) || !Number.isInteger(col)) return "INVALID_MOVE";

  const view = bitView(position);
  if (view.used[colour]![piece]) return "PIECE_USED";

  const orientation = orientations[index]!;
  if (row < 0 || col < 0 || row + orientation.height > size || col + orientation.width > size) return "OFF_BOARD";

  const rows = orientation.rows.map((mask) => mask << col);
  if (rows.some((mask, i) => (mask & view.occupied[row + i]!) !== 0)) return "OVERLAP";

  const own = view.own[colour]!;
  const ownAt = (r: number) => (r >= 0 && r < size ? own[r]! : 0);
  const edge = (r: number) => (ownAt(r) << 1) | (ownAt(r) >>> 1) | ownAt(r - 1) | ownAt(r + 1);
  if (rows.some((mask, i) => (mask & edge(row + i)) !== 0)) return "EDGE_CONTACT";

  if ((position.placed[colour] ?? []).length === 0) {
    const start = starts[colour]!;
    const i = start.row - row;
    const covers = i >= 0 && i < rows.length && ((rows[i]! >>> start.col) & 1) === 1;
    return covers ? undefined : "NOT_ON_START";
  }

  const diagonal = (r: number) => {
    const around = ownAt(r - 1) | ownAt(r + 1);
    return (around << 1) | (around >>> 1);
  };
  return rows.some((mask, i) => (mask & diagonal(row + i)) !== 0) ? undefined : "NO_CORNER_CONTACT";
}
