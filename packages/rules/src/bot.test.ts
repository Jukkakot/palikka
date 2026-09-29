import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cellIndex } from "./board.js";
import { botSeed, chooseBotCell } from "./bot.js";
import { createRng } from "./rng.js";
import { boardFromRows } from "./testing.js";

const view = (rows: string[], targets?: number[]) => ({ board: boardFromRows(rows), seat: 1, seats: [{ seat: 1, placed: 0 }], targets });

describe("bot › Choosing a cell", () => {
  it("always picks an empty cell", () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        const v = view(["1122", "0212"]);
        return v.board[cellIndex(chooseBotCell(v, createRng(seed)))] === 0;
      }),
    );
  });

  it("grows next to its own cells", () => {
    const cell = chooseBotCell(view(["1"]), createRng(3));
    expect([cellIndex({ row: 0, col: 1 }), cellIndex({ row: 1, col: 0 })]).toContain(cellIndex(cell));
  });

  it("goes for an open puzzle target first", () => {
    expect(cellIndex(chooseBotCell(view(["1"], [0, 399]), createRng(3)))).toBe(399);
  });

  it("mixes seat into the seed", () => {
    expect(botSeed(5, 1)).not.toBe(botSeed(5, 2));
  });
});
