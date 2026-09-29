/** Seconds a turn (shift and move together) may take before the other players may kick. */
export const TURN_TIME_LIMIT_SECONDS = 60;

/** Seconds a dropped player keeps their seat before being removed automatically. */
export const DISCONNECT_LIMIT_SECONDS = 300;

export const SEAT_COUNT = 4;

/**
 * The next taken seat clockwise after `from` (1 → 2 → 3 → 4 → 1): `from` itself when it is the
 * only taken seat, 0 when no seat is taken.
 */
export function nextSeat(taken: Iterable<number>, from: number): number {
  const seats = new Set(taken);
  for (let step = 1; step <= SEAT_COUNT; step++) {
    const seat = ((from - 1 + step + SEAT_COUNT) % SEAT_COUNT) + 1;
    if (seats.has(seat)) return seat;
  }
  return 0;
}

export type KickRejection = "WRONG_PHASE" | "NOT_KICKABLE" | "TURN_NOT_EXPIRED";

export interface KickCheck {
  /** Seat of the player asking for the kick. */
  kicker: number;
  /** Seat named in the kick. */
  target: number;
  turnSeat: number;
  /** True once the current turn's time is up. */
  expired: boolean;
  /** True while the game is still in its waiting room. */
  waiting: boolean;
  finished: boolean;
}

/**
 * Why a kick is not allowed, or undefined when it is: only the current player, only by
 * someone else, only after their time is up, and never in the waiting room or a finished game.
 */
export function kickRejection({ kicker, target, turnSeat, expired, waiting, finished }: KickCheck): KickRejection | undefined {
  if (waiting || finished) return "WRONG_PHASE";
  if (target !== turnSeat || target === kicker) return "NOT_KICKABLE";
  if (!expired) return "TURN_NOT_EXPIRED";
  return undefined;
}

/** The seat left alone in the game (it wins when the game is under way), or undefined unless exactly one seat is taken. */
export function soleSurvivor(taken: Iterable<number>): number | undefined {
  const seats = [...new Set(taken)];
  return seats.length === 1 ? seats[0] : undefined;
}
