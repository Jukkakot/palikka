import { BOARD_SIZE } from "./geometry.js";
import { createBoard, isFixed, type Board } from "./board.js";
import { openings, type Rotation, type Tile, type TileKind } from "./tile.js";

const KIND_BY_LETTER: Record<string, TileKind> = { I: "straight", L: "corner", T: "tee" };

function parseToken(token: string, id: number): Tile {
  const match = /^([ILT])(0|90|180|270)$/.exec(token);
  if (!match) throw new Error(`Bad tile token "${token}" (expected e.g. I0, L90, T270)`);
  return { id, kind: KIND_BY_LETTER[match[1]!]!, rotation: Number(match[2]) as Rotation };
}

/**
 * Test fixture: builds a board from 7 lines of 7 tokens plus a spare token.
 * A token is the kind letter (I straight, L corner, T tee) and the rotation,
 * e.g. `L90`. Ids are assigned row-major 0…48; the spare gets 49.
 *
 * ```ts
 * boardFromRows(["L90 I0 T0 …", …], "I90")
 * ```
 */
export function boardFromRows(rows: readonly string[], spare = "I0"): Board {
  if (rows.length !== BOARD_SIZE) throw new Error(`Expected ${BOARD_SIZE} rows, got ${rows.length}`);
  const tokens = rows.flatMap((row) => row.trim().split(/\s+/));
  return createBoard({
    squares: tokens.map((token, i) => parseToken(token, i)),
    spare: parseToken(spare, BOARD_SIZE * BOARD_SIZE),
  });
}

/** A board where every square holds the same token (default: straight, open N and S). */
export function uniformBoard(token = "I0"): Board {
  const row = Array.from({ length: BOARD_SIZE }, () => token).join(" ");
  return boardFromRows(Array.from({ length: BOARD_SIZE }, () => row));
}

/** Returns a copy of `board` with `tile` placed (keeping that square's id) at `index`. */
export function withTile(board: Board, index: number, token: string): Board {
  const squares = board.squares.map((t, i) => (i === index ? parseToken(token, t.id) : t));
  return createBoard({ squares, spare: board.spare });
}

const GLYPHS: Record<string, string> = {
  NS: "│", EW: "─", NE: "└", ES: "┌", SW: "┐", NW: "┘",
  NES: "├", NSW: "┤", ESW: "┬", NEW: "┴",
};

/** One box-drawing glyph for a tile's openings. */
export function tileGlyph(tile: Tile): string {
  return GLYPHS[openings(tile).join("")] ?? "?";
}

/**
 * Readable text of a board for tests, logs and bug reports: one glyph per
 * square showing its openings, fixed squares in brackets, then the spare.
 *
 * ```
 * [┌] ─  [┬] …
 * ```
 */
export function boardToText(board: Board): string {
  const lines: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const cells: string[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const glyph = tileGlyph(board.squares[row * BOARD_SIZE + col]!);
      cells.push(isFixed({ row, col }) ? `[${glyph}]` : ` ${glyph} `);
    }
    lines.push(cells.join(""));
  }
  lines.push(`spare: ${tileGlyph(board.spare)} (tile ${board.spare.id})`);
  return lines.join("\n");
}
