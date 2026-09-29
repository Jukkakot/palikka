import {
  abort,
  applyMove,
  checkPlacement,
  CLASSIC,
  createRng,
  encodeMove,
  legalMoves,
  newPosition,
  ORIENTATIONS,
  PIECE_SIZES,
  winners,
  type Placement,
  type Position,
} from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { chooseMove, greedyPlayer, palikkaGame, randomPlayer } from "./adapter.js";
import { evaluate } from "./evaluation.js";
import { playGame } from "./match.js";

const depth1 = { depth: 1 };
const opening = newPosition(CLASSIC, [1, 2, 3, 4], 1);

/** The rating of `colour`'s move `code` in `position` (the position after it, for the mover). */
function rating(position: Position, code: number): number {
  return evaluate(palikkaGame.play(position, code), position.turn);
}

describe("bot-play › The bot plays a legal move of its colour", () => {
  it("First move covers the start corner", () => {
    const move = chooseMove(opening, 1, depth1, 7)!;
    expect(checkPlacement(opening, 1, move)).toBeUndefined();
    const { cells } = ORIENTATIONS[move.piece]![move.orientation]!;
    expect(cells.some(([r, c]) => move.row + r === 0 && move.col + c === 0)).toBe(true);
  });

  it("Legal moves through a whole game", () => {
    const rng = createRng(11);
    let position = opening;
    while (!position.ended) {
      const move = chooseMove(position, position.turn, depth1, rng);
      expect(move).toBeDefined();
      const result = applyMove(position, position.turn, move!);
      expect(result.ok).toBe(true);
      if (result.ok) position = result.position;
    }
    expect(position.moveNumber).toBeGreaterThan(40);
  });

  it("No move available", () => {
    expect(chooseMove(abort(opening), 1, depth1, 1)).toBeUndefined();
    const out = { ...opening, out: [2] };
    expect(chooseMove(out, 2, depth1, 1)).toBeUndefined();
    expect(chooseMove(newPosition(CLASSIC, [1, 3], 1), 2, depth1, 1)).toBeUndefined();
  });

  it("answers for a colour that is not on turn as if it were", () => {
    const move = chooseMove(opening, 3, depth1, 5)!;
    expect(checkPlacement(opening, 3, move)).toBeUndefined();
  });
});

describe("bot-play › Same position and seed, same move", () => {
  it("Repeated question", () => {
    const [, , , , , position] = playGame(opening, { 1: randomPlayer, 2: randomPlayer, 3: randomPlayer, 4: randomPlayer }, 3);
    const first = chooseMove(position!, position!.turn, depth1, 42);
    expect(chooseMove(position!, position!.turn, depth1, 42)).toEqual(first);
    expect(chooseMove(position!, position!.turn, depth1, createRng(42))).toEqual(first);
  });

  it("Seed breaks ties", () => {
    const best = Math.max(...legalMoves(opening, 1).map((code) => rating(opening, code)));
    const chosen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const move = chooseMove(opening, 1, depth1, seed)!;
      expect(rating(opening, encodeMove(move, 20))).toBe(best);
      chosen.add(JSON.stringify(move));
    }
    expect(chosen.size).toBeGreaterThan(1);
  });
});

describe("bot-play › The bot respects its budget", () => {
  it("Time runs out", () => {
    const move = chooseMove(opening, 1, { timeMs: 1e-6 }, 9)!;
    expect(checkPlacement(opening, 1, move)).toBeUndefined();
  });
});

describe("bot-play › Greedy heuristic", () => {
  it("Bigger piece preferred", () => {
    // Opening: every first move leaves one free corner-ish area; the bot opens with a five-square piece.
    for (let seed = 0; seed < 10; seed++) expect(PIECE_SIZES[chooseMove(opening, 1, depth1, seed)!.piece]).toBe(5);
    // Same shape of line, one square longer: the longer one rates higher.
    const i2 = positionWith([[1, placement("I2", ["##"], 5, 5)]]);
    const i3 = positionWith([[1, placement("I3", ["###"], 5, 5)]]);
    expect(evaluate(i3, 1)).toBeGreaterThan(evaluate(i2, 1));
  });

  it("Blocking an opponent's corner counts", () => {
    // Colour 2 has a single square at (10,10). Colour 1's single square either covers colour 2's
    // free corner (11,11) or sits nearby at (12,13), where a square of colour 3 (out of the game)
    // takes one of its diagonals: colour 1 has three free corners either way.
    const at = (colour: number, row: number, col: number): [number, Placement] => [colour, placement("I1", ["#"], row, col)];
    const colour2 = at(2, 10, 10);
    const blocking = { ...positionWith([colour2, at(1, 11, 11), at(3, 18, 18)], [1, 2, 3]), out: [3] };
    const open = { ...positionWith([colour2, at(1, 12, 13), at(3, 11, 14)], [1, 2, 3]), out: [3] };
    expect(evaluate(blocking, 1)).toBeGreaterThan(evaluate(open, 1));
  });

  it("rates a won end above anything else and a lost end below", () => {
    const [end] = playGame(opening, { 1: greedyPlayer, 2: randomPlayer, 3: randomPlayer, 4: randomPlayer }, 2).slice(-1);
    const [winner] = winners(end!);
    const loser = end!.colours.find((c) => !winners(end!).includes(c))!;
    expect(evaluate(end!, winner!)).toBeGreaterThan(500);
    expect(evaluate(end!, loser)).toBeLessThan(-500);
  });
});

describe("bot-play › Greedy bot is stronger than random play", () => {
  it("One greedy bot against three random players", () => {
    const games = 12;
    let wins = 0;
    for (let seed = 1; seed <= games; seed++) {
      const seat = ((seed - 1) % 4) + 1;
      const bots = { 1: randomPlayer, 2: randomPlayer, 3: randomPlayer, 4: randomPlayer, [seat]: greedyPlayer };
      if (winners(playGame(opening, bots, seed).at(-1)!).includes(seat)) wins++;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.9);
  }, 20_000);
});
