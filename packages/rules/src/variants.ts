import { CLASSIC, type BoardConfig } from "./config.js";

/** The variants a game can be played in; the id is stable, the names live in the client's i18n. */
export const VARIANT_IDS = ["classic", "duo", "double", "trio"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

/** The Duo board: 14×14, start squares at row 5, column 5 and row 10, column 10 (counted from 1). */
export const DUO: BoardConfig = {
  size: 14,
  starts: {
    1: { row: 4, col: 4 },
    2: { row: 9, col: 9 },
  },
};

export interface Variant {
  readonly id: VariantId;
  readonly board: BoardConfig;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** The colours of each seated player, given the seats in ascending order (one group per seat). */
  readonly colourGroups: (seats: readonly number[]) => number[][];
  /** The colour the players take turns with, scoring for no one. */
  readonly shared?: number;
}

export const VARIANTS: Readonly<Record<VariantId, Variant>> = {
  // Perus keeps the seat numbers as colours, so a gap (seats 1, 2, 4) keeps its empty corner.
  classic: { id: "classic", board: CLASSIC, minPlayers: 2, maxPlayers: 4, colourGroups: (seats) => seats.map((s) => [s]) },
  duo: { id: "duo", board: DUO, minPlayers: 2, maxPlayers: 2, colourGroups: () => [[1], [2]] },
  double: { id: "double", board: CLASSIC, minPlayers: 2, maxPlayers: 2, colourGroups: () => [[1, 3], [2, 4]] },
  trio: { id: "trio", board: CLASSIC, minPlayers: 3, maxPlayers: 3, colourGroups: () => [[1], [2], [3]], shared: 4 },
};

export function isVariantId(value: unknown): value is VariantId {
  return typeof value === "string" && (VARIANT_IDS as readonly string[]).includes(value);
}

/** The variant for an id, Perus for anything unknown or missing. */
export function variantOf(id: string | undefined): Variant {
  return isVariantId(id) ? VARIANTS[id] : VARIANTS.classic;
}
