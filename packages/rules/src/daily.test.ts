import { describe, expect, it } from "vitest";
import { cellAt } from "./board.js";
import { dailySeed, DAILY_TARGETS, startDailyPuzzle } from "./daily.js";
import { applyPlace, type GameState } from "./game.js";

describe("daily › Puzzle of the day", () => {
  it("is the same for the same date and differs between dates", () => {
    expect(startDailyPuzzle("2026-10-01", "A").game.targets).toEqual(startDailyPuzzle("2026-10-01", "B").game.targets);
    expect(startDailyPuzzle("2026-10-01", "A").game.targets).not.toEqual(startDailyPuzzle("2026-10-02", "A").game.targets);
    expect(dailySeed("2026-10-01")).toBe(dailySeed("2026-10-01"));
  });

  it("is solved once every target is claimed; par is one turn per target", () => {
    const { game, par } = startDailyPuzzle("2026-10-01", "A");
    expect(par).toBe(DAILY_TARGETS);
    let state: GameState = game;
    for (const t of game.targets!) {
      const result = applyPlace(state, 1, cellAt(t));
      if (!result.ok) throw new Error(result.code);
      state = result.state;
    }
    expect(state.step).toBe("finished");
    expect(state.winnerSeat).toBe(1);
    expect(state.turn).toBe(par);
  });

  it("keeps the player on turn after a miss", () => {
    const { game } = startDailyPuzzle("2026-10-01", "A");
    const miss = [...Array(400).keys()].find((i) => !game.targets!.includes(i))!;
    const result = applyPlace(game, 1, cellAt(miss));
    expect(result.ok && result.state.turnSeat).toBe(1);
    expect(result.ok && result.state.turn).toBe(2);
  });
});
