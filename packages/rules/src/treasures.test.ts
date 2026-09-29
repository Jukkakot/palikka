import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tileAt } from "./board.js";
import { ALL_SQUARES, square } from "./geometry.js";
import { MAX_SEED } from "./rng.js";
import { setupBoard } from "./setup.js";
import { shiftBoard } from "./shift.js";
import { TREASURES, treasureOf } from "./tileSet.js";
import { dealGame, dealTreasures, firstSeat, homeSquare, homeTileId, settleMove, targetTileId, tileOfTreasure } from "./treasures.js";

const seedArb = fc.integer({ min: 0, max: MAX_SEED });
const seatCountArb = fc.integer({ min: 2, max: 4 });

const board = setupBoard(1);
/** A square on `board` whose tile carries a treasure, and that treasure. */
const treasureSquare = () => {
  const sq = ALL_SQUARES.find((s) => treasureOf(tileAt(board, s).id) !== undefined)!;
  return { sq, treasure: treasureOf(tileAt(board, sq).id)! };
};

describe("treasures › Treasure cards dealt evenly", () => {
  it("Four stacks of six", () => {
    const stacks = dealTreasures(7, 4);
    expect(stacks.map((s) => s.length)).toEqual([6, 6, 6, 6]);
    stacks.forEach((s) => expect(new Set(s).size).toBe(6));
    expect(stacks.flat().sort()).toEqual([...TREASURES].sort());
  });

  it("Deal for fewer seats", () => {
    expect(dealTreasures(7, 2).map((s) => s.length)).toEqual([12, 12]);
    expect(dealTreasures(7, 3).map((s) => s.length)).toEqual([8, 8, 8]);
  });

  it("Reproducible deal", () => {
    expect(dealTreasures(12345, 3)).toEqual(dealTreasures(12345, 3));
  });

  it("rejects a seat count outside 2…4", () => {
    expect(() => dealTreasures(1, 1)).toThrow(RangeError);
    expect(() => dealTreasures(1, 5)).toThrow(RangeError);
  });

  it("property: the stacks are equal in size and hold every treasure once, deterministically", () => {
    fc.assert(
      fc.property(seedArb, seatCountArb, (seed, seats) => {
        const stacks = dealTreasures(seed, seats);
        expect(stacks).toHaveLength(seats);
        stacks.forEach((s) => expect(s).toHaveLength(TREASURES.length / seats));
        expect(new Set(stacks.flat()).size).toBe(TREASURES.length);
        expect(dealTreasures(seed, seats)).toEqual(stacks);
      }),
    );
  });
});

describe("treasures › Treasure cards dealt at the start", () => {
  const seatsArb = fc.subarray([1, 2, 3, 4], { minLength: 2, maxLength: 4 });

  it("Four stacks of six", () => {
    const { stacks } = dealGame(7, [1, 2, 3, 4]);
    expect([...stacks.keys()]).toEqual([1, 2, 3, 4]);
    expect([...stacks.values()].map((s) => s.length)).toEqual([6, 6, 6, 6]);
  });

  it("Deal for fewer seats", () => {
    const two = dealGame(7, [3, 1]);
    expect([...two.stacks.keys()]).toEqual([1, 3]);
    expect([...two.stacks.values()].map((s) => s.length)).toEqual([12, 12]);
    expect([...dealGame(7, [1, 2, 4]).stacks.values()].map((s) => s.length)).toEqual([8, 8, 8]);
  });

  it("Reproducible deal", () => {
    expect(dealGame(12345, [1, 3, 4])).toEqual(dealGame(12345, [4, 3, 1]));
  });

  it("Freed seat", () => {
    const { stacks, startSeat } = dealGame(9, [1, 3]);
    expect(stacks.has(2)).toBe(false);
    expect([1, 3]).toContain(startSeat);
  });

  it("rejects fewer than 2 seats or a seat outside 1…4", () => {
    expect(() => dealGame(1, [1])).toThrow(RangeError);
    expect(() => dealGame(1, [1, 5])).toThrow(RangeError);
  });

  it("property: every treasure once in equal stacks, the start seat among the seats, deterministic", () => {
    fc.assert(
      fc.property(seedArb, seatsArb, (seed, seats) => {
        const deal = dealGame(seed, seats);
        expect([...deal.stacks.keys()]).toEqual(seats);
        const all = [...deal.stacks.values()];
        all.forEach((s) => expect(s).toHaveLength(TREASURES.length / seats.length));
        expect(new Set(all.flat()).size).toBe(TREASURES.length);
        expect(seats).toContain(deal.startSeat);
        expect(dealGame(seed, seats)).toEqual(deal);
      }),
    );
  });

  it("every seat can start", () => {
    const starts = new Set(Array.from({ length: 200 }, (_, seed) => dealGame(seed, [1, 2, 3]).startSeat));
    expect([...starts].sort()).toEqual([1, 2, 3]);
  });
});

describe("turns › Current player (first seat)", () => {
  it("First player starts: the seated host, whatever was drawn", () => {
    expect(firstSeat(1, [1, 2, 3], 3)).toBe(1);
  });

  it("Bots only: no seated host keeps the drawn seat", () => {
    expect(firstSeat(0, [1, 2, 3], 2)).toBe(2);
    expect(firstSeat(undefined, [1, 2], 2)).toBe(2);
  });
});

describe("treasures › Collecting a treasure", () => {
  it("Move onto the target", () => {
    const { sq, treasure } = treasureSquare();
    expect(settleMove(board, { seat: 1, square: sq, target: treasure })).toEqual({ collected: treasure, won: false });
  });

  it("Stay on the target", () => {
    // A board whose spare carries a treasure; N1 pushes the pawn on (6,1) off the edge onto the inserted spare.
    const start = Array.from({ length: 100 }, (_, seed) => setupBoard(seed)).find((b) => treasureOf(b.spare.id))!;
    const target = treasureOf(start.spare.id)!;
    const { board: shifted, pawns } = shiftBoard(start, "N1", 0, [square(6, 1)]);
    expect(pawns[0]).toEqual(square(0, 1));
    expect(settleMove(shifted, { seat: 1, square: pawns[0]!, target })).toEqual({ collected: target, won: false });
  });

  it("Passing through", () => {
    const { treasure } = treasureSquare();
    // Ending anywhere other than the target's tile collects nothing, whatever the route was.
    const elsewhere = ALL_SQUARES.find((s) => treasureOf(tileAt(board, s).id) !== treasure)!;
    expect(settleMove(board, { seat: 1, square: elsewhere, target: treasure })).toEqual({ won: false });
  });

  it("Someone else's target", () => {
    const { sq, treasure } = treasureSquare();
    const mine = TREASURES.find((t) => t !== treasure)!;
    expect(settleMove(board, { seat: 1, square: sq, target: mine })).toEqual({ won: false });
  });
});

describe("treasures › Return home to win", () => {
  it("Heading home", () => {
    // With no target left, the target tile is the start corner.
    expect(targetTileId(1, undefined)).toBe(homeTileId(1));
    expect(tileAt(board, homeSquare(1)).id).toBe(homeTileId(1));
  });

  it("Winning", () => {
    for (const seat of [1, 2, 3, 4]) {
      expect(settleMove(board, { seat, square: homeSquare(seat), target: undefined })).toEqual({ won: true });
    }
  });

  it("Home too early", () => {
    expect(settleMove(board, { seat: 1, square: homeSquare(1), target: "dragon" })).toEqual({ won: false });
  });

  it("someone else's corner does not win", () => {
    expect(settleMove(board, { seat: 1, square: homeSquare(2), target: undefined })).toEqual({ won: false });
  });

  it("start corner tiles are 0, 3, 15, 12 and carry no treasure", () => {
    expect([1, 2, 3, 4].map(homeTileId)).toEqual([0, 3, 15, 12]);
    [1, 2, 3, 4].forEach((seat) => expect(treasureOf(homeTileId(seat))).toBeUndefined());
  });

  it("every treasure has its tile", () => {
    TREASURES.forEach((t) => expect(treasureOf(tileOfTreasure(t))).toBe(t));
  });
});
