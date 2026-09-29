import { describe, expect, it } from "vitest";
import { allowedShifts, botMoveAfterShift, type BotView } from "./bot.js";
import { hintMove, hintSeed, hintTurn } from "./botHint.js";
import { createRng } from "./rng.js";
import { ALL_SQUARES, type Square } from "./geometry.js";
import { isReachable } from "./move.js";
import { isValidSeed } from "./rng.js";
import { setupBoard } from "./setup.js";
import { shiftBoard } from "./shift.js";
import { TREASURES } from "./tileSet.js";
import { homeSquare, settleMove, targetTileId } from "./treasures.js";

/** Seat 1 (the viewer) at home, seat 3 somewhere on the board with a few found treasures. */
function viewOf(seed: number): BotView {
  const target = TREASURES[seed % TREASURES.length]!;
  const found = TREASURES.filter((t) => t !== target).slice(0, 3);
  return {
    board: setupBoard(seed),
    seat: 1,
    seats: [
      { seat: 1, pawn: homeSquare(1), found: 0, cardsLeft: 12 },
      { seat: 3, pawn: ALL_SQUARES[(seed * 17) % 49]!, found: 3, cardsLeft: 9, foundTreasures: found },
    ],
    lastInsertion: undefined,
    target,
  };
}

/** The view of the move step after `turn`'s shift. */
function afterShift(view: BotView, insertion: BotView["lastInsertion"] & string, rotation: 0 | 90 | 180 | 270): BotView {
  const shifted = shiftBoard(view.board, insertion, rotation, view.seats.map((s) => s.pawn));
  return { ...view, board: shifted.board, seats: view.seats.map((s, i) => ({ ...s, pawn: shifted.pawns[i]! })), lastInsertion: insertion };
}

function canCollect(view: BotView): boolean {
  const tileId = targetTileId(view.seat, view.target);
  return allowedShifts(view.lastInsertion).some(({ insertion, rotation }) => {
    const shifted = shiftBoard(view.board, insertion, rotation, [view.seats[0]!.pawn]);
    const i = shifted.board.squares.findIndex((t) => t.id === tileId);
    return i !== -1 && isReachable(shifted.board, shifted.pawns[0]!, ALL_SQUARES[i]!);
  });
}

const reachable = (view: BotView, to: Square) => isReachable(view.board, view.seats[0]!.pawn, to);

describe("board-view › Hint", () => {
  it("Same position, same hint", () => {
    for (const seed of [1, 2, 3]) {
      const view = viewOf(seed);
      expect(isValidSeed(hintSeed(view))).toBe(true);
      expect(hintTurn(view)).toEqual(hintTurn(viewOf(seed)));
    }
  });

  it("Hint for the shift: a legal turn that collects when it can", () => {
    let collecting = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const view = viewOf(seed);
      const turn = hintTurn(view);
      const moved = afterShift(view, turn.insertion, turn.rotation);
      expect(reachable(moved, turn.to)).toBe(true);
      if (canCollect(view)) {
        collecting++;
        expect(settleMove(moved.board, { seat: 1, square: turn.to, target: view.target }).collected).toBe(view.target);
      }
    }
    expect(collecting).toBeGreaterThan(0);
  });

  it("Hint for the move: a reachable square, the target when it is in reach", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const view = viewOf(seed);
      const turn = hintTurn(view);
      // Any allowed shift, not only the hinted one.
      for (const shift of [turn, allowedShifts(undefined)[seed % 48]!]) {
        const moved = afterShift(view, shift.insertion, shift.rotation);
        const to = hintMove(moved);
        expect(reachable(moved, to)).toBe(true);
        const tileId = targetTileId(1, view.target);
        const i = moved.board.squares.findIndex((t) => t.id === tileId);
        if (i !== -1 && reachable(moved, ALL_SQUARES[i]!)) expect(to).toEqual(ALL_SQUARES[i]);
      }
    }
  });

  it("the move hint needs the shift just made", () => {
    expect(() => hintMove(viewOf(1))).toThrow();
  });
});

describe("autoplay › Bot plays an auto-played seat", () => {
  it("Handed over mid-turn: walks to a reachable square, the target when it is in reach", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const view = viewOf(seed);
      const shift = allowedShifts(undefined)[(seed * 7) % 48]!;
      const moved = afterShift(view, shift.insertion, shift.rotation);
      const to = botMoveAfterShift(moved, createRng(seed));
      expect(reachable(moved, to)).toBe(true);
      const i = moved.board.squares.findIndex((t) => t.id === targetTileId(1, view.target));
      if (i !== -1 && reachable(moved, ALL_SQUARES[i]!)) expect(to).toEqual(ALL_SQUARES[i]);
    }
  });
});
