import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allowedShifts, type BotSeatView, type BotView } from "./bot.js";
import { samplingMove, samplingStrategy } from "./botSampling.js";
import type { Board } from "./board.js";
import { ALL_SQUARES, sameSquare, square, type Square } from "./geometry.js";
import { isReachable } from "./move.js";
import { createRng } from "./rng.js";
import { setupBoard } from "./setup.js";
import { reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { TREASURES, type TreasureId } from "./tileSet.js";
import { homeSquare, settleMove, targetTileId } from "./treasures.js";

const sampling = samplingStrategy();
const opponents: BotSeatView[] = [
  { seat: 2, pawn: homeSquare(2), found: 0, cardsLeft: 8 },
  { seat: 4, pawn: square(3, 3), found: 2, cardsLeft: 6 },
];

function viewOf(board: Board, target: TreasureId | undefined, pawn: Square = homeSquare(1), lastInsertion?: InsertionId): BotView {
  return { board, seat: 1, seats: [{ seat: 1, pawn, found: 0, cardsLeft: target === undefined ? 0 : 8 }, ...opponents], lastInsertion, target };
}

/** Whether some allowed shift lets seat 1 reach its target this turn. */
function canCollect(view: BotView): boolean {
  const tileId = targetTileId(1, view.target);
  return allowedShifts(view.lastInsertion).some(({ insertion, rotation }) => {
    const shifted = shiftBoard(view.board, insertion, rotation, view.seats.map((s) => s.pawn));
    const i = shifted.board.squares.findIndex((t) => t.id === tileId);
    return i !== -1 && isReachable(shifted.board, shifted.pawns[0]!, ALL_SQUARES[i]!);
  });
}

function findView(wanted: (view: BotView) => boolean, make: (seed: number) => BotView): BotView {
  for (let seed = 1; seed < 500; seed++) {
    const view = make(seed);
    if (wanted(view)) return view;
  }
  throw new Error("No such view in 500 seeds");
}

function play(view: BotView, seed = 7) {
  const turn = sampling(view, createRng(seed));
  const shifted = shiftBoard(view.board, turn.insertion, turn.rotation, view.seats.map((s) => s.pawn));
  return { turn, board: shifted.board, pawn: shifted.pawns[0]! };
}

describe("bots › Bot turn choice (sampling search)", () => {
  it("Target reachable this turn", () => {
    const view = findView(canCollect, (seed) => viewOf(setupBoard(seed), TREASURES[seed % TREASURES.length]));
    const { turn, board, pawn } = play(view);
    expect(isReachable(board, pawn, turn.to)).toBe(true);
    expect(settleMove(board, { seat: 1, square: turn.to, target: view.target }).collected).toBe(view.target);
  });

  it("Heading home", () => {
    const view = findView(canCollect, (seed) => viewOf(setupBoard(seed), undefined, square(3, 3)));
    const { turn, board } = play(view);
    expect(sameSquare(turn.to, homeSquare(1))).toBe(true);
    expect(settleMove(board, { seat: 1, square: turn.to, target: undefined }).won).toBe(true);
  });

  it("Never the forbidden reverse", () => {
    const view = viewOf(setupBoard(3), "skull", homeSquare(1), "N1");
    for (let seed = 0; seed < 20; seed++) expect(sampling(view, createRng(seed)).insertion).not.toBe("S1");
  });

  it("is reproducible from the seed", () => {
    const view = viewOf(setupBoard(11), TREASURES[0]);
    expect(sampling(view, createRng(5))).toEqual(sampling(view, createRng(5)));
  });

  it("property: the chosen shift is never the reverse and the move is reachable after it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 48 }), fc.constantFrom<InsertionId | undefined>(undefined, "N1", "W5"), (seed, t, p, last) => {
        const view = viewOf(setupBoard(seed), TREASURES[t], ALL_SQUARES[p]!, last);
        const { turn, board, pawn } = play(view, seed);
        if (last) expect(turn.insertion).not.toBe(reverseOf(last));
        expect(isReachable(board, pawn, turn.to)).toBe(true);
      }),
      { numRuns: 40 },
    );
  });

  it("the move after a shift already made is reachable, the target when it is in reach", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const start = viewOf(setupBoard(seed), TREASURES[seed % 24], ALL_SQUARES[(seed * 13) % 49]!);
      const { insertion, rotation } = allowedShifts(undefined)[seed % 40]!;
      const shifted = shiftBoard(start.board, insertion, rotation, start.seats.map((s) => s.pawn));
      const view: BotView = { ...start, board: shifted.board, seats: start.seats.map((s, i) => ({ ...s, pawn: shifted.pawns[i]! })), lastInsertion: insertion };
      const to = samplingMove(view, createRng(seed));
      expect(isReachable(shifted.board, shifted.pawns[0]!, to)).toBe(true);
      const i = shifted.board.squares.findIndex((tile) => tile.id === targetTileId(1, start.target));
      if (i !== -1 && isReachable(shifted.board, shifted.pawns[0]!, ALL_SQUARES[i]!)) expect(to).toEqual(ALL_SQUARES[i]);
    }
  });
});
