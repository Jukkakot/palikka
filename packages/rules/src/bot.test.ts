import { describe, expect, it } from "vitest";
import { botRng, botSeed, simpleBotMove } from "./bot.js";
import { CLASSIC } from "./config.js";
import { positionWith } from "./engineFixtures.js";
import { PIECE_SIZES } from "./pieces.js";
import { applyMove } from "./play.js";
import { checkPlacement, newPosition, type Position } from "./position.js";
import { createRng } from "./rng.js";

describe("simple bot", () => {
  it("opens with a five-square piece on the start corner", () => {
    const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    const move = simpleBotMove(start, 1, createRng(3))!;
    expect(PIECE_SIZES[move.piece]).toBe(5);
    expect(checkPlacement(start, 1, move)).toBeUndefined();
  });

  it("is deterministic for a seed", () => {
    const start = newPosition(CLASSIC, [1, 2], 1);
    expect(simpleBotMove(start, 1, botRng(9, start, 1))).toEqual(simpleBotMove(start, 1, botRng(9, start, 1)));
    expect(botSeed(9, 0, 1)).not.toBe(botSeed(9, 1, 1));
    expect(botSeed(9, 0, 1)).not.toBe(botSeed(9, 0, 2));
  });

  it("returns undefined for a colour with no legal move", () => {
    const full: Position = { ...positionWith([]), cells: new Array<number>(400).fill(2) };
    expect(simpleBotMove(full, 1, createRng(1))).toBeUndefined();
  });

  it("plays whole games with legal moves only, always a largest piece that fits", () => {
    for (const seed of [1, 2, 3]) {
      let position = newPosition(CLASSIC, [1, 2, 3, 4], 1);
      while (!position.ended) {
        const colour = position.turn;
        const move = simpleBotMove(position, colour, botRng(seed, position, colour))!;
        const result = applyMove(position, colour, move);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        position = result.position;
      }
      expect(position.moveNumber).toBeGreaterThan(40);
    }
  });
});
