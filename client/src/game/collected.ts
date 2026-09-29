import { TILE_SET, type TreasureId } from "@labyrinth/rules";

/** Treasures collected by anyone: no longer drawn on their tiles. */
export type Collected = ReadonlySet<TreasureId>;

/** The union of every seat's found treasures (synced to players and spectators alike). */
export function collectedTreasures(seats: readonly { found: readonly TreasureId[] }[]): Collected {
  return new Set(seats.flatMap((s) => s.found));
}

/** Whether tile `id` carries a treasure that has already been collected. */
export function isCollected(id: number, collected: Collected | undefined): boolean {
  const treasure = TILE_SET[id]?.treasure;
  return treasure !== undefined && collected?.has(treasure) === true;
}
