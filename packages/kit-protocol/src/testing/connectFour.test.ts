import { describe, expect, it } from "vitest";
import { COLUMNS, connectFourRules as rules, type ConnectFourGame, ROWS } from "./connectFour.js";

const seats = [
  { seat: 1, name: "Maija", bot: false },
  { seat: 2, name: "Pekka", bot: false },
];

const fresh = () => rules.start(7, seats, {});

/** Plays `columns` in turn from `game`, every move required to be accepted. */
function play(columns: number[], game: ConnectFourGame = fresh()): ConnectFourGame {
  return columns.reduce((g, col) => {
    const result = rules.play(g, rules.seatOnTurn(g), col);
    if (!result.ok) throw new Error(`column ${col} refused: ${result.code}`);
    return result.game;
  }, game);
}

describe("Connect Four test game", () => {
  it("starts with the lowest seat on turn and takes 2 seats up to the option's most", () => {
    expect(rules.seatOnTurn(fresh())).toBe(1);
    expect(rules.seatRange({})).toEqual({ min: 2, max: 4 });
    expect(rules.seatRange({ seats: 2 })).toEqual({ min: 2, max: 2 });
  });

  it("four across wins", () => {
    const game = play([0, 0, 1, 1, 2, 2, 3]);
    expect([rules.isOver(game), rules.winners(game), rules.seatOnTurn(game)]).toEqual([true, [1], 0]);
  });

  it("four down wins", () => {
    const game = play([0, 1, 0, 1, 0, 1, 0]);
    expect(rules.winners(game)).toEqual([1]);
  });

  it("four on the rising diagonal wins", () => {
    // Seat 1 at (5,0) (4,1) (3,2) (2,3); seat 2 fills beneath.
    const game = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(rules.winners(game)).toEqual([1]);
  });

  it("four on the falling diagonal wins", () => {
    const game = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(rules.winners(game)).toEqual([1]);
  });

  it("a full board with no four in a row is a draw", () => {
    // Columns in pairs of pairs, so no line of four forms: 0 0 1 1 … then the other half shifted.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    expect(order).toHaveLength(COLUMNS * ROWS);
    const game = play(order);
    expect([rules.isOver(game), rules.winners(game)]).toEqual([true, []]);
  });

  it("refuses a full column and changes nothing", () => {
    const full = play([0, 0, 0, 0, 0, 0]);
    const before = JSON.stringify(full);
    expect(rules.play(full, 1, 0)).toEqual({ ok: false, code: "COLUMN_FULL", facts: { seat: 1, move: "0" } });
    expect(JSON.stringify(full)).toBe(before);
  });

  it("refuses a move out of turn, by a stranger and after the end", () => {
    expect(rules.play(fresh(), 2, 0)).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(rules.play(fresh(), 3, 0)).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(rules.play(fresh(), 1, 7)).toEqual({ ok: false, code: "INVALID_COMMAND" });
    const over = play([0, 0, 1, 1, 2, 2, 3]);
    expect(rules.play(over, 2, 4)).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("the other seat wins when one leaves; with more seats the turn moves on", () => {
    const game = rules.removeSeat(play([3]), 1);
    expect([rules.isOver(game), rules.winners(game)]).toEqual([true, [2]]);

    const three = rules.start(1, [...seats, { seat: 3, name: "Liisa", bot: true }], {});
    const after = rules.removeSeat(three, 1);
    expect([rules.isOver(after), rules.seatOnTurn(after)]).toEqual([false, 2]);
  });

  it("ends with no winner when nobody is left", () => {
    const game = rules.end(play([3]));
    expect([rules.isOver(game), rules.winners(game), rules.seatOnTurn(game)]).toEqual([true, [], 0]);
  });

  it("the fallback move is the first column with room", () => {
    expect(rules.fallbackMove(fresh())).toBe(0);
    expect(rules.fallbackMove(play([0, 0, 0, 0, 0, 0]))).toBe(1);
    expect(rules.fallbackMove(play([0, 0, 1, 1, 2, 2, 3]))).toBeUndefined();
  });

  it("gives log facts and a move text", () => {
    expect(rules.turnFacts(play([0]))).toEqual({ moves: 1 });
    expect(rules.finishFacts(play([0, 0, 1, 1, 2, 2, 3]))).toEqual({ moves: 7 });
    expect(rules.moveText(4)).toBe("col4");
  });
});
