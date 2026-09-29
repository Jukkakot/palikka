import { describe, expect, it } from "vitest";
import { greedyBot, randomBot } from "./players.js";
import { testRng } from "./search/testing/grab.js";
import type { Budget, Game } from "./types.js";

/** Toy game: two players take turns adding 1–3 to a running total; the game ends at 10. */
interface Race {
  readonly total: number;
  readonly turn: 0 | 1;
}

const race: Game<Race, number, 0 | 1> = {
  toMove: (s) => s.turn,
  isOver: (s) => s.total >= 10,
  moves: (s) => (s.total >= 10 ? [] : [1, 2, 3].filter((m) => s.total + m <= 10)),
  play: (s, m) => ({ total: s.total + m, turn: s.turn === 0 ? 1 : 0 }),
};

const depth1: Budget = { depth: 1 };
const start: Race = { total: 0, turn: 0 };

describe("greedy bot", () => {
  it("plays the best-rated move", () => {
    const bot = greedyBot(race, (s) => s.total);
    for (let seed = 0; seed < 20; seed++) expect(bot.choose(start, depth1, testRng(seed))).toBe(3);
  });

  it("rates the state after the move for the player who moved", () => {
    const seen: [number, number][] = [];
    const bot = greedyBot(race, (s, player) => {
      seen.push([s.total, player]);
      return -s.total;
    });
    expect(bot.choose({ total: 4, turn: 1 }, depth1, testRng(1))).toBe(1);
    expect(seen.map(([total]) => total).sort()).toEqual([5, 6, 7]);
    expect(seen.every(([, player]) => player === 1)).toBe(true);
  });

  it("same state and seed give the same move; seeds break ties, never towards a worse move", () => {
    // Moves 2 and 3 rate 1, move 1 rates 0.
    const bot = greedyBot(race, (s) => (s.total >= 2 ? 1 : 0));
    const chosen = new Set<number | undefined>();
    for (let seed = 0; seed < 50; seed++) {
      const move = bot.choose(start, depth1, testRng(seed));
      expect(bot.choose(start, depth1, testRng(seed))).toBe(move);
      chosen.add(move);
    }
    expect([...chosen].sort()).toEqual([2, 3]);
  });

  it("stops rating when the time runs out and returns the best so far", () => {
    let clock = 0;
    let rated = 0;
    const bot = greedyBot(
      race,
      (s) => {
        rated++;
        return s.total;
      },
      { now: () => (clock += 10) },
    );
    // Deadline at 10 + 15 = 25: the first move is always rated, the second at 20, then 30 ≥ 25.
    const move = bot.choose(start, { timeMs: 15 }, testRng(3));
    expect(rated).toBe(2);
    expect([1, 2, 3]).toContain(move);
  });

  it("always rates at least one move, however small the time budget", () => {
    let rated = 0;
    let clock = 0;
    const bot = greedyBot(race, () => rated++, { now: () => clock++ });
    expect(bot.choose(start, { timeMs: 0.001 }, testRng(1))).toBeDefined();
    expect(rated).toBe(1);
  });

  it("returns no move when the game is over or the player has none", () => {
    const bot = greedyBot(race, (s) => s.total);
    expect(bot.choose({ total: 10, turn: 0 }, depth1, testRng(1))).toBeUndefined();
    const stuck: Game<Race, number, 0 | 1> = { ...race, moves: () => [] };
    expect(greedyBot(stuck, () => 0).choose(start, depth1, testRng(1))).toBeUndefined();
  });

  it("refuses a budget without a limit or with a limit that is not positive", () => {
    const bot = greedyBot(race, (s) => s.total);
    for (const budget of [{}, { timeMs: 0 }, { depth: 0 }, { depth: 1.5 }, { timeMs: Number.NaN }, { iterations: 0 }, { iterations: 2.5 }]) {
      expect(() => bot.choose(start, budget, testRng(1))).toThrow(RangeError);
    }
    expect(bot.choose(start, { timeMs: 50, depth: 3 }, testRng(1))).toBe(3);
  });

  it("Limit that does not apply: iterations alone play the one-ply move", () => {
    const bot = greedyBot(race, (s) => s.total);
    for (let seed = 1; seed <= 5; seed++) {
      expect(bot.choose(start, { iterations: 300 }, testRng(seed))).toBe(bot.choose(start, depth1, testRng(seed)));
    }
  });
});

describe("random bot", () => {
  it("plays a legal move, the same one for the same seed, and none when over", () => {
    const bot = randomBot(race);
    const seen = new Set<number | undefined>();
    for (let seed = 0; seed < 30; seed++) {
      const move = bot.choose({ total: 8, turn: 0 }, depth1, testRng(seed));
      expect([1, 2]).toContain(move);
      expect(bot.choose({ total: 8, turn: 0 }, depth1, testRng(seed))).toBe(move);
      seen.add(move);
    }
    expect(seen.size).toBe(2);
    expect(bot.choose({ total: 10, turn: 1 }, depth1, testRng(1))).toBeUndefined();
  });
});
