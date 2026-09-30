/** What the tray showed: its colour, the pieces that fit somewhere (undefined: not known) and those placed. */
export interface TraySnapshot {
  colour: number;
  fits?: ReadonlySet<number>;
  placed: ReadonlySet<number>;
}

const sameSet = (a: ReadonlySet<number> | undefined, b: ReadonlySet<number> | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.size === b.size && [...a].every((x) => b.has(x)));

/** Whether two snapshots show the same thing (by content). */
export const sameTray = (a: TraySnapshot, b: TraySnapshot) => a.colour === b.colour && sameSet(a.fits, b.fits) && sameSet(a.placed, b.placed);

/**
 * The pieces that froze between two snapshots of the same colour: fitting before, fitting nowhere
 * now, and not placed. None on a colour switch or when either side is not known.
 */
export function newlyFrozen(prev: TraySnapshot | undefined, next: TraySnapshot): Set<number> {
  const frozen = new Set<number>();
  if (!prev || prev.colour !== next.colour || !prev.fits || !next.fits) return frozen;
  for (const piece of prev.fits) if (!next.fits.has(piece) && !next.placed.has(piece)) frozen.add(piece);
  return frozen;
}

/** The pieces placed between two snapshots of the same colour (their slots fade out). */
export function newlyPlaced(prev: TraySnapshot | undefined, next: TraySnapshot): Set<number> {
  const placed = new Set<number>();
  if (!prev || prev.colour !== next.colour) return placed;
  for (const piece of next.placed) if (!prev.placed.has(piece)) placed.add(piece);
  return placed;
}
