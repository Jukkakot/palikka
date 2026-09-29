/** Seconds a turn may take before the other players may kick. */
export const TURN_TIME_LIMIT_SECONDS = 120;

/** Seconds a dropped player keeps their seat before being removed automatically. */
export const DISCONNECT_LIMIT_SECONDS = 300;

export const SEAT_COUNT = 4;

/** A game needs at least this many seated players (people and bots) to start. */
export const MIN_SEATS = 2;

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
