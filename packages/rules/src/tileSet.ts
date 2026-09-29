import { FIXED_SQUARES } from "./board.js";
import type { Square } from "./geometry.js";
import type { Rotation, TileKind } from "./tile.js";

/** Our own treasure names (not the original game's): objects on fixed tiles, creatures on movable ones. */
export const TREASURES = [
  "crown", "key", "gem", "coins", "sword", "shield", "book", "map", "scroll", "potion", "lamp", "chest",
  "dragon", "bat", "spider", "butterfly", "ghost", "cat", "fish", "horse", "beetle", "mouse", "skull", "deer",
] as const;
export type TreasureId = (typeof TREASURES)[number];

/** Static description of a tile: the same for this id in every game. */
export interface TileSpec {
  readonly id: number;
  readonly kind: TileKind;
  readonly fixed: boolean;
  readonly treasure?: TreasureId;
}

/**
 * The fixed tiles in row-major order of FIXED_SQUARES, as in the original game:
 * start corners open inward, edge T-junctions closed toward the edge, and the
 * inner four closed W (2,2), N (2,4), S (4,2), E (4,4).
 * Tee: 0° closed N, 90° closed E, 180° closed S, 270° closed W.
 * Corner: 0° N,E · 90° E,S · 180° S,W · 270° W,N.
 */
export const FIXED_LAYOUT: readonly { readonly kind: TileKind; readonly rotation: Rotation }[] = [
  { kind: "corner", rotation: 90 }, // (0,0) start
  { kind: "tee", rotation: 0 }, // (0,2)
  { kind: "tee", rotation: 0 }, // (0,4)
  { kind: "corner", rotation: 180 }, // (0,6) start
  { kind: "tee", rotation: 270 }, // (2,0)
  { kind: "tee", rotation: 270 }, // (2,2) inner
  { kind: "tee", rotation: 0 }, // (2,4) inner
  { kind: "tee", rotation: 90 }, // (2,6)
  { kind: "tee", rotation: 270 }, // (4,0)
  { kind: "tee", rotation: 180 }, // (4,2) inner
  { kind: "tee", rotation: 90 }, // (4,4) inner
  { kind: "tee", rotation: 90 }, // (4,6)
  { kind: "corner", rotation: 0 }, // (6,0) start
  { kind: "tee", rotation: 180 }, // (6,2)
  { kind: "tee", rotation: 180 }, // (6,4)
  { kind: "corner", rotation: 270 }, // (6,6) start
];

export const FIXED_TILE_COUNT = FIXED_LAYOUT.length;
export const TILE_COUNT = 50;

function buildTileSet(): TileSpec[] {
  const objects = TREASURES.slice(0, 12);
  const creatures = TREASURES.slice(12);
  const specs: TileSpec[] = [];

  // Ids 0–15: fixed tiles; the 12 fixed T-junctions carry the objects.
  for (const { kind } of FIXED_LAYOUT) {
    const id = specs.length;
    specs.push(kind === "tee" ? { id, kind, fixed: true, treasure: objects.shift()! } : { id, kind, fixed: true });
  }
  // Ids 16–27: straight, no treasure.
  for (let i = 0; i < 12; i++) specs.push({ id: specs.length, kind: "straight", fixed: false });
  // Ids 28–43: corners; the first 6 carry creatures.
  for (let i = 0; i < 16; i++) {
    const id = specs.length;
    specs.push(i < 6 ? { id, kind: "corner", fixed: false, treasure: creatures.shift()! } : { id, kind: "corner", fixed: false });
  }
  // Ids 44–49: T-junctions, all with creatures.
  for (let i = 0; i < 6; i++) specs.push({ id: specs.length, kind: "tee", fixed: false, treasure: creatures.shift()! });

  return specs.map((s) => Object.freeze(s));
}

/** All 50 tiles by id. */
export const TILE_SET: readonly TileSpec[] = Object.freeze(buildTileSet());

export const MOVABLE_TILE_IDS: readonly number[] = TILE_SET.filter((t) => !t.fixed).map((t) => t.id);

export function tileSpec(id: number): TileSpec {
  const spec = TILE_SET[id];
  if (!spec) throw new RangeError(`Unknown tile id ${id}`);
  return spec;
}

export function treasureOf(id: number): TreasureId | undefined {
  return tileSpec(id).treasure;
}

/** The fixed square of fixed tile `id` (ids 0–15). */
export function fixedSquareOf(id: number): Square {
  const sq = FIXED_SQUARES[id];
  if (!sq || !tileSpec(id).fixed) throw new RangeError(`Tile ${id} is not a fixed tile`);
  return sq;
}
