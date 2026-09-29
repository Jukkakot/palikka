import { describe, expect, it } from "vitest";
import { tileAt, type Board } from "./board.js";
import { DAILY_PAR, DAILY_SEAT, applyPuzzleMove, dailySeed, startDailyPuzzle } from "./daily.js";
import { bestLine, bestMove, fewestTurns } from "./dailySolver.js";
import { applyShift, targetOf, type GameState } from "./game.js";
import type { Square } from "./geometry.js";
import { reachableSquares } from "./move.js";
import { setupBoard } from "./setup.js";
import { INSERTIONS, reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import { ROTATIONS } from "./tile.js";
import { treasureOf, type TreasureId } from "./tileSet.js";
import { homeSquare } from "./treasures.js";

/** Treasures one turn reaches, by plain enumeration (the reference for the solver). */
function oneTurnTreasures(board: Board, start: Square, last?: InsertionId): Set<TreasureId> {
  const found = new Set<TreasureId>();
  for (const insertion of INSERTIONS) {
    if (last && insertion === reverseOf(last)) continue;
    for (const rotation of ROTATIONS) {
      const { board: b, pawns } = shiftBoard(board, insertion, rotation, [start]);
      for (const sq of reachableSquares(b, pawns[0]!)) {
        const t = treasureOf(tileAt(b, sq).id);
        if (t) found.add(t);
      }
    }
  }
  return found;
}

describe("daily-puzzle › Best possible result (solver)", () => {
  const board = setupBoard(42);
  const home = homeSquare(DAILY_SEAT);

  it("1 turn exactly for the treasures one shift and move can reach, in under a second for 2 turns", () => {
    const started = Date.now();
    const best = fewestTurns(board, home, 2);
    expect(Date.now() - started).toBeLessThan(1000);
    const one = oneTurnTreasures(board, home);
    for (const [t, turns] of best) expect(turns === 1).toBe(one.has(t));
    expect([...one].every((t) => best.get(t) === 1)).toBe(true);
  });

  it("the forbidden reverse push is not searched", () => {
    const last: InsertionId = "S1";
    const best = fewestTurns(board, home, 1, last);
    expect(new Set(best.keys())).toEqual(oneTurnTreasures(board, home, last));
  });
});

describe("daily-puzzle › Same puzzle for everyone on a day", () => {
  it("Two players, same day: the same board, spare and destination", () => {
    expect(startDailyPuzzle("2026-09-27", "Aino")).toEqual(startDailyPuzzle("2026-09-27", "Aino"));
    expect(dailySeed("2026-09-27")).toBe(dailySeed("2026-09-27"));
  });

  it("Next day: another puzzle", () => {
    const today = startDailyPuzzle("2026-09-27", "Aino").game;
    const tomorrow = startDailyPuzzle("2026-09-28", "Aino").game;
    expect(tomorrow.board).not.toEqual(today.board);
  });

  it("one seat on turn at home with one destination whose best is the puzzle's par (2)", () => {
    for (const date of ["2026-09-27", "2026-09-28", "2026-10-01"]) {
      const { game, par } = startDailyPuzzle(date, "Aino");
      expect(game.seats).toHaveLength(1);
      const [seat] = game.seats;
      expect(seat!.stack).toHaveLength(1);
      expect(par).toBe(DAILY_PAR);
      expect(fewestTurns(game.board, homeSquare(DAILY_SEAT), 2).get(targetOf(seat!)!)).toBe(par);
    }
  });
});

describe("daily-puzzle › Goal and score", () => {
  it("Solved: finding the destination ends the puzzle in that turn; other moves pass the turn back", () => {
    const { game } = startDailyPuzzle("2026-09-27", "Aino");
    const target = targetOf(game.seats[0]!)!;
    // Staying put passes the turn back to the player.
    const shifted = applyShift(game, DAILY_SEAT, "N1", 0);
    if (!shifted.ok) throw new Error(shifted.code);
    const stay = applyPuzzleMove(shifted.state, DAILY_SEAT, shifted.state.seats[0]!.pawn);
    expect(stay.ok && stay.state.step).toBe("shift");
    expect(stay.ok && stay.state.turn).toBe(2);

    // Put the pawn on the target's tile square as if walked there: the move onto it solves.
    const at = shifted.state.board.squares.findIndex((t) => treasureOf(t.id) === target);
    const onBoard: GameState =
      at === -1 ? shifted.state : { ...shifted.state, seats: shifted.state.seats.map((s) => ({ ...s, pawn: { row: Math.floor(at / 7), col: at % 7 } })) };
    if (at === -1) return;
    const solved = applyPuzzleMove(onBoard, DAILY_SEAT, onBoard.seats[0]!.pawn);
    expect(solved.ok && solved.state.step).toBe("finished");
    expect(solved.ok && solved.state.winnerSeat).toBe(DAILY_SEAT);
    expect(solved.ok && solved.state.turn).toBe(1);
  });
});

describe("daily-puzzle › Puzzle hint follows a best route", () => {
  for (const date of ["2026-09-27", "2026-09-28", "2026-10-01"]) {
    it(`Following the hint solves at par (${date}): the best line has par steps and the engine solves with it`, () => {
      const { game, par } = startDailyPuzzle(date, "Aino");
      const target = targetOf(game.seats[0]!)!;
      const line = bestLine(game.board, game.seats[0]!.pawn, target, undefined, par)!;
      expect(line).toHaveLength(par);
      let state: GameState = game;
      for (const step of line) {
        const shifted = applyShift(state, DAILY_SEAT, step.insertion, step.rotation);
        if (!shifted.ok) throw new Error(shifted.code);
        const moved = applyPuzzleMove(shifted.state, DAILY_SEAT, step.to);
        if (!moved.ok) throw new Error(moved.code);
        state = moved.state;
      }
      expect(state.step).toBe("finished");
      expect(state.turn).toBe(par);
    });
  }

  it("Hint on the move step: after a shift off the best line, the square keeps the fewest turns", () => {
    const { game } = startDailyPuzzle("2026-09-27", "Aino");
    const target = targetOf(game.seats[0]!)!;
    const shifted = applyShift(game, DAILY_SEAT, "N1", 0);
    if (!shifted.ok) throw new Error(shifted.code);
    const reach = reachableSquares(shifted.state.board, shifted.state.seats[0]!.pawn);
    const to = bestMove(shifted.state.board, reach, target, "N1", 2)!;
    expect(reach).toContainEqual(to);
    // From the hinted square the rest is as short as from any reachable square.
    const rest = (sq: Square) => bestLine(shifted.state.board, sq, target, "N1", 2)?.length ?? 99;
    expect(rest(to)).toBe(Math.min(...reach.map(rest)));
  });
});
