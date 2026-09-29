import { createBoard, isFixed, type Board } from "./board.js";
import { ALL_SQUARES, squareIndex } from "./geometry.js";
import { createRng, shuffle } from "./rng.js";
import { ROTATIONS, type Tile } from "./tile.js";
import { FIXED_LAYOUT, fixedSquareOf, FIXED_TILE_COUNT, MOVABLE_TILE_IDS, tileSpec } from "./tileSet.js";

const MOVABLE_SQUARES = ALL_SQUARES.filter((sq) => !isFixed(sq));

/**
 * The starting board of a game: fixed tiles in the original layout, the 34
 * movable tiles shuffled onto the 33 movable squares (row-major) and the
 * spare, each with a random rotation. Deterministic in `seed` — the draw order
 * (shuffle first, then one rotation per placed tile, spare last) is part of
 * that contract and pinned by a golden test.
 */
export function setupBoard(seed: number): Board {
  const rng = createRng(seed);
  const squares: Tile[] = new Array(ALL_SQUARES.length);

  for (let id = 0; id < FIXED_TILE_COUNT; id++) {
    const { kind, rotation } = FIXED_LAYOUT[id]!;
    squares[squareIndex(fixedSquareOf(id))] = { id, kind, rotation };
  }

  const order = shuffle(rng, MOVABLE_TILE_IDS);
  const placed = order.map((id): Tile => ({ id, kind: tileSpec(id).kind, rotation: ROTATIONS[rng.int(0, 3)]! }));

  MOVABLE_SQUARES.forEach((sq, i) => {
    squares[squareIndex(sq)] = placed[i]!;
  });
  return createBoard({ squares, spare: placed[MOVABLE_SQUARES.length]! });
}
