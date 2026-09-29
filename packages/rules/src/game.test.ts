import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cellAt, cellIndex, cellsOf, CELL_COUNT } from "./board.js";
import { chooseBotCell } from "./bot.js";
import { applyPlace, botRngFor, botViewOf, endGame, leader, PLACEMENTS_PER_SEAT, removeSeat, startGame, type GameState } from "./game.js";
import { boardFromRows } from "./testing.js";

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ seat: i + 1, name: `P${i + 1}`, bot: i > 0 }));

/** Plays the game to its end with the bot choosing every cell. */
function playOut(game: GameState): GameState {
  let state = game;
  while (state.step !== "finished") {
    const cell = chooseBotCell(botViewOf(state, state.turnSeat), botRngFor(state, state.turnSeat));
    const result = applyPlace(state, state.turnSeat, cell);
    if (!result.ok) throw new Error(result.code);
    state = result.state;
  }
  return state;
}

describe("game › Start", () => {
  it("starts on an empty board with the host on turn", () => {
    const game = startGame(7, seats(3), 2);
    expect(game.board).toHaveLength(CELL_COUNT);
    expect(game.board.every((c) => c === 0)).toBe(true);
    expect(game.turnSeat).toBe(2);
    expect(game.step).toBe("play");
  });

  it("draws a seated start seat without a host", () => {
    fc.assert(fc.property(fc.nat(), (seed) => [1, 2, 3].includes(startGame(seed, seats(3)).turnSeat)));
  });
});

describe("game › Placing", () => {
  it("claims the cell and passes the turn clockwise", () => {
    const result = applyPlace(startGame(1, seats(2), 1), 1, { row: 3, col: 4 });
    expect(result.ok && result.state.board[cellIndex({ row: 3, col: 4 })]).toBe(1);
    expect(result.ok && result.state.turnSeat).toBe(2);
  });

  it("refuses out of turn, a taken cell, off the board and when finished", () => {
    const game = startGame(1, seats(2), 1);
    expect(applyPlace(game, 2, { row: 0, col: 0 })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(applyPlace(game, 3, { row: 0, col: 0 })).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(applyPlace(game, 1, { row: 20, col: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    const taken = { ...game, board: boardFromRows(["2"]) };
    expect(applyPlace(taken, 1, { row: 0, col: 0 })).toEqual({ ok: false, code: "CELL_TAKEN" });
    expect(applyPlace(endGame(game, 0), 1, { row: 0, col: 0 })).toEqual({ ok: false, code: "WRONG_PHASE" });
  });
});

describe("game › End", () => {
  it("ends after every seat's last turn with the most cells winning", () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 2, max: 4 }), (seed, n) => {
        const end = playOut(startGame(seed, seats(n), 1));
        expect(end.seats.every((s) => s.placed === PLACEMENTS_PER_SEAT)).toBe(true);
        expect(end.winnerSeat).toBe(leader(end));
      }),
      { numRuns: 30 },
    );
  });

  it("breaks a tie by the lowest seat", () => {
    expect(leader({ board: boardFromRows(["0220011"]), seats: seats(2) })).toBe(1);
  });

  it("the last seat standing wins; the leaver's cells stay", () => {
    const placed = applyPlace(startGame(1, seats(2), 1), 1, cellAt(0));
    const game = removeSeat(placed.ok ? placed.state : startGame(1, seats(2)), 1);
    expect(game.step).toBe("finished");
    expect(game.winnerSeat).toBe(2);
    expect(cellsOf(game.board, 1)).toBe(1);
  });

  it("a leaver on turn hands it to the next seat", () => {
    const game = removeSeat(startGame(1, seats(3), 2), 2);
    expect(game.turnSeat).toBe(3);
    expect(game.step).toBe("play");
  });
});
