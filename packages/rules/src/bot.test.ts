import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allowedShifts, botSeed, chooseBotTurn, greedyBotTurn, type BotSeatView, type BotStrategy, type BotView } from "./bot.js";
import { DEFAULT_WEIGHTS, lookaheadStrategy } from "./botLookahead.js";
import { simulateGame } from "./botTournament.js";
import type { Board } from "./board.js";
import { ALL_SQUARES, sameSquare, square, type Square } from "./geometry.js";
import { isReachable, reachableSquares } from "./move.js";
import { createRng, isValidSeed, MAX_SEED } from "./rng.js";
import { setupBoard } from "./setup.js";
import { INSERTIONS, reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { ROTATIONS } from "./tile.js";
import { TREASURES, treasureOf, type TreasureId } from "./tileSet.js";
import { homeSquare, settleMove, targetTileId } from "./treasures.js";

const CENTRE = square(3, 3);

function viewOf(board: Board, target: TreasureId | undefined, pawn = homeSquare(1), lastInsertion?: InsertionId, others: BotSeatView[] = []): BotView {
  return { board, seat: 1, seats: [{ seat: 1, pawn, found: 0, cardsLeft: 1 }, ...others], lastInsertion, target };
}

const at = (board: Board, tileId: number): Square | undefined => {
  const i = board.squares.findIndex((t) => t.id === tileId);
  return i === -1 ? undefined : ALL_SQUARES[i];
};

/** Whether some allowed shift lets seat 1 reach its target this turn. */
function canCollect(view: BotView): boolean {
  const tileId = targetTileId(view.seat, view.target);
  return allowedShifts(view.lastInsertion).some(({ insertion, rotation }) => {
    const shifted = shiftBoard(view.board, insertion, rotation, [view.seats[0]!.pawn]);
    const target = at(shifted.board, tileId);
    return target !== undefined && isReachable(shifted.board, shifted.pawns[0]!, target);
  });
}

/** The first view over seeded boards and treasures for which `wanted` says yes. */
function findView(wanted: (view: BotView) => boolean, make: (seed: number) => BotView, from = 1): BotView {
  for (let seed = from; seed < from + 500; seed++) {
    const view = make(seed);
    if (wanted(view)) return view;
  }
  throw new Error("No such view in 500 seeds");
}
const plain = (seed: number) => viewOf(setupBoard(seed), TREASURES[seed % TREASURES.length]);

function play(view: BotView, seed = 7, strategy: BotStrategy = chooseBotTurn) {
  const turn = strategy(view, createRng(seed));
  const pawns = view.seats.map((s) => s.pawn);
  const shifted = shiftBoard(view.board, turn.insertion, turn.rotation, pawns);
  return { turn, board: shifted.board, pawn: shifted.pawns[0]!, pawns: shifted.pawns };
}

/**
 * Reference for the bot's own look-ahead, written with the ordinary rules: from `pawn` on `board`,
 * the share of next shifts (all but the reverse of `last`) that bring the target in reach, minus
 * a tenth of the mean distance to it (7 while it is out on the spare).
 */
function ownOutlook(board: Board, pawn: Square, tileId: number, last: InsertionId): number {
  let reach = 0;
  let dist = 0;
  let n = 0;
  for (const insertion of INSERTIONS.filter((id) => id !== reverseOf(last))) {
    for (const rotation of ROTATIONS) {
      const shifted = shiftBoard(board, insertion, rotation, [pawn]);
      const p = shifted.pawns[0]!;
      const target = at(shifted.board, tileId);
      n++;
      if (target === undefined) {
        dist += 7;
        continue;
      }
      if (isReachable(shifted.board, p, target)) reach++;
      dist += Math.abs(p.row - target.row) + Math.abs(p.col - target.col);
    }
  }
  return reach / n - (0.1 * dist) / n;
}

/** Reference: the share of treasures (other than `ownTarget`) the pawn could reach with some shift after `last`. */
function opponentChance(board: Board, pawn: Square, last: InsertionId, ownTarget: TreasureId | undefined): number {
  const reached = new Set<TreasureId>();
  for (const insertion of INSERTIONS.filter((id) => id !== reverseOf(last))) {
    for (const rotation of ROTATIONS) {
      const shifted = shiftBoard(board, insertion, rotation, [pawn]);
      for (const sq of reachableSquares(shifted.board, shifted.pawns[0]!)) {
        const t = treasureOf(shifted.board.squares[sq.row * 7 + sq.col]!.id);
        if (t !== undefined && t !== ownTarget) reached.add(t);
      }
    }
  }
  return reached.size / (ownTarget === undefined ? 24 : 23);
}

/** Whether a pawn heading home to `home` could get there with some shift after `last`. */
function canGoHome(board: Board, pawn: Square, home: Square, last: InsertionId): boolean {
  return allowedShifts(last).some(({ insertion, rotation }) => {
    const shifted = shiftBoard(board, insertion, rotation, [pawn]);
    return isReachable(shifted.board, shifted.pawns[0]!, home);
  });
}

describe("bots › Bot turn choice", () => {
  it("Target reachable this turn", () => {
    const view = findView(canCollect, plain);
    const { turn, board, pawn } = play(view);
    expect(isReachable(board, pawn, turn.to)).toBe(true);
    expect(settleMove(board, { seat: 1, square: turn.to, target: view.target }).collected).toBe(view.target);
  });

  it("Target out of reach", () => {
    // Without opponents, the bot picks the best outlook for its next turn among every choice.
    const own = lookaheadStrategy({ ...DEFAULT_WEIGHTS, block: 0, home: 0 });
    for (const from of [1, 100, 200]) {
      const view = findView((v) => !canCollect(v), plain, from);
      const tileId = targetTileId(1, view.target);
      const { turn, board, pawn } = play(view, 7, own);
      expect(isReachable(board, pawn, turn.to)).toBe(true);
      let best = -Infinity;
      for (const { insertion, rotation } of allowedShifts(view.lastInsertion)) {
        const shifted = shiftBoard(view.board, insertion, rotation, [view.seats[0]!.pawn]);
        for (const to of reachableSquares(shifted.board, shifted.pawns[0]!)) best = Math.max(best, ownOutlook(shifted.board, to, tileId, insertion));
      }
      expect(ownOutlook(board, turn.to, tileId, turn.insertion)).toBeCloseTo(best, 9);
    }
  });

  it("Blocking the opponents", () => {
    // Over many positions, the opponent is left fewer treasures within reach than without blocking.
    const selfish = lookaheadStrategy({ ...DEFAULT_WEIGHTS, block: 0, home: 0 });
    const make = (seed: number) =>
      viewOf(setupBoard(seed), TREASURES[seed % TREASURES.length], homeSquare(1), undefined, [{ seat: 3, pawn: ALL_SQUARES[(seed * 17) % 49]!, found: 0, cardsLeft: 12 }]);
    let blocking = 0;
    let without = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const view = make(seed);
      for (const [strategy, add] of [[chooseBotTurn, (x: number) => (blocking += x)], [selfish, (x: number) => (without += x)]] as const) {
        const { turn, board, pawns } = play(view, 7, strategy);
        add(opponentChance(board, pawns[1]!, turn.insertion, view.target));
      }
    }
    expect(blocking).toBeLessThan(without * 0.95);
  });

  it("Found treasures are no threat", () => {
    // Every treasure but the bot's own target is found: no opponent can be heading for any of them.
    const selfish = lookaheadStrategy({ ...DEFAULT_WEIGHTS, block: 0, home: 0 });
    const minding = lookaheadStrategy({ ...DEFAULT_WEIGHTS, blockChance: 1 });
    let blockedWithoutLists = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const target = TREASURES[seed % TREASURES.length]!;
      const opponent: BotSeatView = { seat: 3, pawn: ALL_SQUARES[(seed * 17) % 49]!, found: 11, cardsLeft: 1 };
      const withLists = viewOf(setupBoard(seed), target, homeSquare(1), undefined, [
        { ...opponent, foundTreasures: TREASURES.filter((t) => t !== target) },
      ]);
      const withoutLists = viewOf(setupBoard(seed), target, homeSquare(1), undefined, [opponent]);
      expect(minding(withLists, createRng(7))).toEqual(selfish(withLists, createRng(7)));
      if (JSON.stringify(minding(withoutLists, createRng(7))) !== JSON.stringify(selfish(withoutLists, createRng(7)))) blockedWithoutLists++;
    }
    // Without the found lists the same positions do get blocking moves.
    expect(blockedWithoutLists).toBeGreaterThan(0);
  });

  it("Opponent about to win", () => {
    // Seat 3 has every treasure and could get home next turn; the bot can't collect but can stop it.
    const home = homeSquare(3);
    const make = (seed: number) =>
      viewOf(setupBoard(seed), TREASURES[seed % TREASURES.length], homeSquare(1), undefined, [{ seat: 3, pawn: ALL_SQUARES[(seed * 17) % 49]!, found: 12, cardsLeft: 0 }]);
    const stoppable = (view: BotView) =>
      !canCollect(view) &&
      allowedShifts(undefined).some(({ insertion, rotation }) => {
        const shifted = shiftBoard(view.board, insertion, rotation, view.seats.map((s) => s.pawn));
        return !canGoHome(shifted.board, shifted.pawns[1]!, home, insertion);
      }) &&
      allowedShifts(undefined).some(({ insertion, rotation }) => {
        const shifted = shiftBoard(view.board, insertion, rotation, view.seats.map((s) => s.pawn));
        return canGoHome(shifted.board, shifted.pawns[1]!, home, insertion);
      });
    const view = findView(stoppable, make);
    // It minds its opponents four turns in five; here it always does.
    const { turn, board, pawns } = play(view, 7, lookaheadStrategy({ ...DEFAULT_WEIGHTS, blockChance: 1 }));
    expect(canGoHome(board, pawns[1]!, home, turn.insertion)).toBe(false);
  });

  it("Never the forbidden reverse", () => {
    const view = viewOf(setupBoard(3), "skull", homeSquare(1), "N1");
    for (let seed = 0; seed < 50; seed++) expect(chooseBotTurn(view, createRng(seed)).insertion).not.toBe("S1");
  });

  it("Heading home", () => {
    // From the centre, home is not reachable without the right shift.
    const view = findView(canCollect, () => viewOf(setupBoard(5), undefined, CENTRE));
    const { turn, board } = play(view);
    expect(sameSquare(turn.to, homeSquare(1))).toBe(true);
    expect(settleMove(board, { seat: 1, square: turn.to, target: undefined }).won).toBe(true);
  });

  it("is reproducible from the seed", () => {
    const view = viewOf(setupBoard(11), TREASURES[0]);
    expect(chooseBotTurn(view, createRng(5))).toEqual(chooseBotTurn(view, createRng(5)));
  });

  it("property: the chosen shift is never the reverse and the move is reachable after it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_SEED }),
        fc.integer({ min: 0, max: MAX_SEED }),
        fc.constantFrom(...ALL_SQUARES),
        fc.constantFrom(...ALL_SQUARES),
        fc.constantFrom(...INSERTIONS),
        fc.option(fc.constantFrom(...TREASURES), { nil: undefined }),
        (boardSeed, rngSeed, pawn, other, last, target) => {
          const view = viewOf(setupBoard(boardSeed), target, pawn, last, [{ seat: 2, pawn: other, found: 3, cardsLeft: 3 }]);
          const { turn, board, pawn: moved } = play(view, rngSeed);
          expect(turn.insertion).not.toBe(reverseOf(last));
          expect(isReachable(board, moved, turn.to)).toBe(true);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("botSeed gives valid, seat-specific seeds", () => {
    expect(isValidSeed(botSeed(MAX_SEED, 4))).toBe(true);
    expect(botSeed(42, 1)).not.toBe(botSeed(42, 2));
    expect(botSeed(42, 3)).toBe(botSeed(42, 3));
  });

  it("the greedy baseline still ends as close to the target as any choice allows", () => {
    const view = findView((v) => !canCollect(v), plain);
    const tileId = targetTileId(1, view.target);
    const distance = (board: Board, to: Square) => {
      const t = at(board, tileId);
      return t === undefined ? 100 : Math.abs(to.row - t.row) + Math.abs(to.col - t.col);
    };
    let best = Infinity;
    for (const { insertion, rotation } of allowedShifts(undefined)) {
      const shifted = shiftBoard(view.board, insertion, rotation, [view.seats[0]!.pawn]);
      for (const to of reachableSquares(shifted.board, shifted.pawns[0]!)) best = Math.min(best, distance(shifted.board, to));
    }
    const { turn, board } = play(view, 7, greedyBotTurn);
    expect(distance(board, turn.to)).toBe(best);
  });
});

/** Whole games per player count: a quick 5 by default, 20 with `BOT_SIM=full` (run it when a strategy changes). */
// The rules package has no Node types; the test runner is Node all the same.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SIM_SEEDS = env.BOT_SIM === "full" ? 20 : 5;

describe("bots › Bots finish a game (simulation)", () => {
  for (const seats of [[1, 3], [1, 2, 4], [1, 2, 3, 4]]) {
    it(`${seats.length} bots end with a winner within the turn cap over ${SIM_SEEDS} seeds`, { timeout: 5 * 60 * 1000 }, () => {
      for (let seed = 1; seed <= SIM_SEEDS; seed++) {
        const result = simulateGame(seed, new Map(seats.map((s) => [s, chooseBotTurn])));
        expect(result, `seed ${seed}`).toBeDefined();
        expect(seats).toContain(result!.winner);
      }
    });
  }
});
