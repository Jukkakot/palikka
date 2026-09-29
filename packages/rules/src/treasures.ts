import { START_CORNERS, tileAt, type Board } from "./board.js";
import { sameSquare, type Square } from "./geometry.js";
import { createRng, shuffle, type Rng } from "./rng.js";
import { FIXED_TILE_COUNT, fixedSquareOf, TILE_SET, TREASURES, treasureOf, type TreasureId } from "./tileSet.js";

export const MIN_SEATS = 2;
export const MAX_SEATS = 4;

/**
 * Deals the 24 treasure cards evenly: a seeded shuffle of `TREASURES`, cut
 * into consecutive stacks of 24 / `seatCount` (seat 1's stack first). The
 * first card of a stack is the first target. Deterministic in `seed`.
 */
export function dealTreasures(seed: number, seatCount: number): TreasureId[][] {
  return dealFrom(createRng(seed), seatCount);
}

function dealFrom(rng: Rng, seatCount: number): TreasureId[][] {
  if (!Number.isInteger(seatCount) || seatCount < MIN_SEATS || seatCount > MAX_SEATS) {
    throw new RangeError(`Seat count must be ${MIN_SEATS}…${MAX_SEATS}, got ${seatCount}`);
  }
  const deck = shuffle(rng, TREASURES);
  const size = TREASURES.length / seatCount;
  return Array.from({ length: seatCount }, (_, i) => deck.slice(i * size, (i + 1) * size));
}

export interface GameDeal {
  /** The stack of each seated seat. */
  stacks: Map<number, TreasureId[]>;
  /** The seat that takes the first turn, one of the seated seats. */
  startSeat: number;
}

/**
 * The opening of a game: the treasure stacks for the seated `seats` (handed out in ascending
 * seat order, as `dealTreasures`) and the start seat, drawn from the same seeded RNG after the
 * deal. Deterministic in `seed` and the set of seats.
 */
export function dealGame(seed: number, seats: Iterable<number>): GameDeal {
  const ordered = [...new Set(seats)].sort((a, b) => a - b);
  if (ordered.some((seat) => !Number.isInteger(seat) || seat < 1 || seat > MAX_SEATS)) {
    throw new RangeError(`Seats must be 1…${MAX_SEATS}, got ${ordered.join(",")}`);
  }
  const rng = createRng(seed);
  const deck = dealFrom(rng, ordered.length);
  const stacks = new Map(ordered.map((seat, i) => [seat, deck[i]!]));
  return { stacks, startSeat: ordered[rng.int(0, ordered.length - 1)]! };
}

/**
 * Who takes the first turn: the host, so the person who started the game plays at once; without a
 * seated host (a game of bots only), the seat `drawn` from the deal.
 */
export function firstSeat(hostSeat: number | undefined, seats: Iterable<number>, drawn: number): number {
  return hostSeat !== undefined && [...seats].includes(hostSeat) ? hostSeat : drawn;
}

/** The start corner of seat 1–4 (clockwise from the top-left). */
export function homeSquare(seat: number): Square {
  const corner = START_CORNERS[seat - 1];
  if (!corner) throw new RangeError(`Seat must be 1…${MAX_SEATS}, got ${seat}`);
  return corner;
}

/** Id of the fixed start-corner tile of seat 1–4. */
export function homeTileId(seat: number): number {
  const home = homeSquare(seat);
  for (let id = 0; id < FIXED_TILE_COUNT; id++) if (sameSquare(fixedSquareOf(id), home)) return id;
  throw new Error(`No fixed tile on the start corner of seat ${seat}`); // the fixed layout covers every corner
}

/** Id of the one tile carrying `treasure`. */
export function tileOfTreasure(treasure: TreasureId): number {
  const tile = TILE_SET.find((t) => t.treasure === treasure);
  if (!tile) throw new Error(`No tile carries ${treasure}`); // the tile set carries every treasure
  return tile.id;
}

/** The tile a player is heading for: their target's tile, or their start corner when `target` is undefined (all found). */
export function targetTileId(seat: number, target: TreasureId | undefined): number {
  return target === undefined ? homeTileId(seat) : tileOfTreasure(target);
}

export interface MoveEnd {
  seat: number;
  /** Where the pawn's move ended (staying included). */
  square: Square;
  /** Current target; undefined once every card of the stack is found (heading home). */
  target: TreasureId | undefined;
}

export interface MoveOutcome {
  /** The target collected by this move, if the move ended on its tile. */
  collected?: TreasureId;
  /** True when the player, heading home, ended the move on their start corner. */
  won: boolean;
}

/**
 * What the end of a move does: collect the current target when the pawn ends
 * on its tile, or win when heading home and ending on the start corner.
 * Passing through a square never counts; only the current target is looked at.
 */
export function settleMove(board: Board, { seat, square, target }: MoveEnd): MoveOutcome {
  if (target === undefined) return { won: sameSquare(square, homeSquare(seat)) };
  return treasureOf(tileAt(board, square).id) === target ? { collected: target, won: false } : { won: false };
}
