import { describe, expect, it } from "vitest";
import { botRng, simpleBotMove } from "./bot.js";
import { CLASSIC, type BoardConfig } from "./config.js";
import { placement } from "./engineFixtures.js";
import { endGame, isFinished, playMove, removeSeat, startGame, type Game, type GameSeat } from "./game.js";
import type { Placement } from "./moves.js";

const seat = (n: number, bot = false): GameSeat => ({ seat: n, name: `P${n}`, bot });
const seats = (...ns: number[]) => ns.map((n) => seat(n));

/** A 3×3 board with three corners: small enough to get colours stuck by hand. */
const TINY: BoardConfig = { size: 3, starts: { 1: { row: 0, col: 0 }, 2: { row: 0, col: 2 }, 3: { row: 2, col: 2 } } };

function play(game: Game, colour: number, move: Placement): Game {
  const result = playMove(game, colour, move);
  if (!result.ok) throw new Error(result.code);
  return result.game;
}

/** Plays the game to its end with the simple bot moving for everyone. */
function playOut(game: Game): Game {
  let current = game;
  while (!isFinished(current)) {
    const { turn } = current.position;
    current = play(current, turn, simpleBotMove(current.position, turn, botRng(current.seed, current.position, turn))!);
  }
  return current;
}

describe("game-room › Seats and the start", () => {
  it("Two people and a bot: the seated colours play and colour 1 starts", () => {
    const game = startGame(1, [seat(2), seat(1), seat(4, true)]);
    expect(game.position.colours).toEqual([1, 2, 4]);
    expect(game.seats.map((s) => s.seat)).toEqual([1, 2, 4]);
    expect(game.position.turn).toBe(1);
    expect(game.winners).toEqual([]);
  });

  it("Lowest seat starts", () => {
    expect(startGame(1, seats(3, 2)).position.turn).toBe(2);
  });
});

describe("game-room › A move", () => {
  const start = startGame(5, seats(1, 2));

  it("Legal first move: accepted, then the next colour is on turn", () => {
    const next = play(start, 1, placement("I1", ["#"], 0, 0));
    expect(next.position.cells[0]).toBe(1);
    expect(next.position.turn).toBe(2);
  });

  it("Illegal move: NOT_ON_START and nothing changes", () => {
    expect(playMove(start, 1, placement("I1", ["#"], 5, 5))).toEqual({ ok: false, code: "NOT_ON_START" });
    expect(start.position.cells.every((c) => c === 0)).toBe(true);
  });

  it("Not your turn", () => {
    expect(playMove(start, 2, placement("I1", ["#"], 0, 19))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("refuses a seat that is not in the game, malformed moves and moves after the end", () => {
    expect(playMove(start, 3, placement("I1", ["#"], 19, 19))).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(playMove(start, 1, { piece: 99, orientation: 0, row: 0, col: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(playMove(endGame(start), 1, placement("I1", ["#"], 0, 0))).toEqual({ ok: false, code: "WRONG_PHASE" });
  });
});

describe("game-end-and-scoring › A colour leaves the game", () => {
  it("Leaver on turn: its squares stay, it is out and the next colour is on turn", () => {
    let game = startGame(1, seats(1, 2, 3));
    game = play(game, 1, placement("I1", ["#"], 0, 0));
    game = play(game, 2, placement("I1", ["#"], 0, 19));
    game = play(game, 3, placement("I1", ["#"], 19, 19));
    game = play(game, 1, placement("I2", ["##"], 1, 1));
    expect(game.position.turn).toBe(2);
    const after = removeSeat(game, 2);
    expect(after.position.cells[19]).toBe(2);
    expect(after.position.out).toContain(2);
    expect(after.position.turn).toBe(3);
    expect(after.left).toEqual([2]);
    expect(after.seats.map((s) => s.seat)).toEqual([1, 3]);
    expect(isFinished(after)).toBe(false);
  });

  it("Last one standing: the game ends and the other colour is the only winner", () => {
    const game = removeSeat(startGame(1, seats(1, 2)), 1);
    expect(isFinished(game)).toBe(true);
    expect(game.position.aborted).toBe(false);
    expect(game.winners).toEqual([2]);
  });

  it("Leaver cannot win: the best score among those that stayed wins", () => {
    let game = startGame(1, seats(1, 2, 3), TINY);
    game = play(game, 1, placement("V3", ["#.", "##"], 0, 0));
    game = removeSeat(game, 1);
    game = play(game, 2, placement("I1", ["#"], 0, 2));
    game = play(game, 3, placement("I1", ["#"], 2, 2));
    expect(isFinished(game)).toBe(true);
    // Colour 1 has −86 (the best) but left; 2 and 3 share −88.
    expect(game.winners).toEqual([2, 3]);
  });

  it("does nothing for a finished game or a seat not in it", () => {
    const game = startGame(1, seats(1, 2));
    expect(removeSeat(game, 3)).toBe(game);
    const ended = endGame(game);
    expect(removeSeat(ended, 1)).toBe(ended);
  });
});

describe("game-room › End and result", () => {
  it("a game played out ends with winners by score, and an aborted game has none", () => {
    const game = playOut(startGame(42, seats(1, 2, 3, 4), CLASSIC));
    expect(game.position.ended).toBe(true);
    expect(game.winners.length).toBeGreaterThan(0);
    expect(endGame(startGame(1, seats(1, 2))).winners).toEqual([]);
  });
});
