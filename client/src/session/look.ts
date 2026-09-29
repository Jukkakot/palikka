import { isLook, pickLook, type Look } from "@labyrinth/protocol";

/** The pawn the player picked on this device; stored only once they pick one. */
const KEY = "labyrinth.look";

export function loadLook(storage: Storage | undefined = globalThis.localStorage): Look | undefined {
  try {
    const look = Number(storage?.getItem(KEY));
    return isLook(look) ? look : undefined;
  } catch {
    return undefined;
  }
}

export function saveLook(look: Look, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, String(look));
  } catch {
    // Storage blocked (private mode): the seat's own pawn is used next time.
  }
}

/**
 * Pawns for a game on the device, by seat: the player (seat `mySeat`) gets `preferred` (the seat's
 * own without one), then every other seat in order picks as a bot does on the server.
 */
export function deviceLooks(seats: readonly number[], mySeat: number, preferred?: Look): Record<number, Look> {
  const looks: Record<number, Look> = { [mySeat]: pickLook([], mySeat, preferred) };
  for (const seat of seats) if (seat !== mySeat) looks[seat] = pickLook(Object.values(looks), seat);
  return looks;
}
