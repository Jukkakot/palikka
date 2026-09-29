/**
 * Pawns ("looks"): a colour-blind-safe colour always paired with a shape, numbered like the seats
 * whose default they are: 1 blue circle, 2 orange square, 3 green triangle, 4 pink diamond.
 */
export const LOOKS = [1, 2, 3, 4] as const;
export type Look = (typeof LOOKS)[number];

export function isLook(value: unknown): value is Look {
  return LOOKS.includes(value as Look);
}

/**
 * The pawn for a player taking `seat` while `taken` pawns are held: the preferred one if free, else
 * the seat's own if free, else the lowest free one. At most four players, so one is always free.
 */
export function pickLook(taken: Iterable<number>, seat: number, preferred?: number): Look {
  const held = new Set(taken);
  if (isLook(preferred) && !held.has(preferred)) return preferred;
  if (isLook(seat) && !held.has(seat)) return seat;
  return LOOKS.find((look) => !held.has(look)) ?? 1;
}

/** The `setLook` command: a seated person picks a free pawn in the waiting room. */
export interface LookPayload {
  look: Look;
}
