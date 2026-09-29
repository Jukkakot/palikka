import { DIRECTIONS, rotateDirection, type Direction } from "./geometry.js";

/** `tee` is the T-junction. */
export type TileKind = "straight" | "corner" | "tee";
export const TILE_KINDS: readonly TileKind[] = ["straight", "corner", "tee"];

/** Clockwise rotation in degrees. */
export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** A tile is its kind and rotation; its openings are derived. The id never changes. */
export interface Tile {
  readonly id: number;
  readonly kind: TileKind;
  readonly rotation: Rotation;
}

/** Openings at rotation 0 — shaped like the letters I, L and T. */
const BASE_OPENINGS: Record<TileKind, readonly Direction[]> = {
  straight: ["N", "S"],
  corner: ["N", "E"],
  tee: ["E", "S", "W"],
};

/** The open sides of `tile`, in N, E, S, W order. */
export function openings(tile: Tile): Direction[] {
  const steps = tile.rotation / 90;
  const open = new Set(BASE_OPENINGS[tile.kind].map((dir) => rotateDirection(dir, steps)));
  return DIRECTIONS.filter((dir) => open.has(dir));
}

export function isOpen(tile: Tile, dir: Direction): boolean {
  return openings(tile).includes(dir);
}

/** The tile turned clockwise by `steps` quarter turns (negative = counter-clockwise). */
export function rotate(tile: Tile, steps = 1): Tile {
  const index = (((tile.rotation / 90 + steps) % 4) + 4) % 4;
  return { ...tile, rotation: ROTATIONS[index]! };
}
