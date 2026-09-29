import { describe, expect, it } from "vitest";
import {
  checkRequirement,
  defaultAnchor,
  markdownReport,
  pairwise,
  rate,
  schedule,
  summarize,
  tournamentResult,
  type GameResult,
  type ScheduledGame,
} from "./index.js";

/** A 2-seat result where `winner` (a bot name, or "draw") takes the comparison. */
function duel(game: ScheduledGame, winner: string): GameResult {
  const seats = game.swapped ? [game.pairing[1], game.pairing[0]] : [...game.pairing];
  const scores = winner === "draw" ? [0, 0] : seats.map((s) => (s === winner ? 1 : 0));
  return { ...game, seats, scores };
}

/** Games between a and b where a takes `aWins` of `total` comparisons (the rest go to b). */
function results(a: string, b: string, aWins: number, total: number): GameResult[] {
  return schedule([a, b], total, 1).map((g, i) => duel(g, i < aWins ? a : b));
}

describe("schedule", () => {
  it("Seat swap with the same seed", () => {
    const games = schedule(["A", "B"], 4, 7);
    expect(games.map((g) => [g.seed, g.swapped])).toEqual([
      [7, false],
      [7, true],
      [8, false],
      [8, true],
    ]);
    expect(games.every((g) => g.pairing[0] === "A" && g.pairing[1] === "B")).toBe(true);
  });

  it("Round robin", () => {
    const games = schedule(["A", "B", "C"], 10, 1);
    expect(games).toHaveLength(30);
    const count = (a: string, b: string) => games.filter((g) => g.pairing[0] === a && g.pairing[1] === b).length;
    expect([count("A", "B"), count("A", "C"), count("B", "C")]).toEqual([10, 10, 10]);
    expect(games.map((g) => g.index)).toEqual([...Array(30).keys()]);
  });

  it("refuses an odd number of games, a single bot and a bot named twice", () => {
    expect(() => schedule(["A", "B"], 3, 1)).toThrow(/even/);
    expect(() => schedule(["A"], 2, 1)).toThrow(/two bots/);
    expect(() => schedule(["A", "A"], 2, 1)).toThrow(/twice/);
  });
});

describe("pairwise", () => {
  it("4-colour game", () => {
    const comparisons = pairwise(["A", "B", "A", "B"], [-5, -10, -10, -20]);
    expect(comparisons).toHaveLength(4);
    const forA = comparisons.reduce((s, c) => s + (c.a === "A" ? c.points : 1 - c.points), 0);
    expect(forA).toBe(3.5);
  });

  it("2-colour game drawn", () => {
    expect(pairwise(["A", "B"], [-3, -3])).toEqual([{ a: "A", b: "B", points: 0.5 }]);
  });
});

describe("summarize", () => {
  it("gives each pairing's share with an interval that narrows with more seed pairs", () => {
    const few = summarize(["A", "B"], results("A", "B", 3, 4)).pairings[0]!;
    expect(few.share).toBe(0.75);
    const many = summarize(["A", "B"], schedule(["A", "B"], 200, 1).map((g, i) => duel(g, i % 4 === 3 ? "B" : "A"))).pairings[0]!;
    expect(many.share).toBe(0.75);
    expect(many.low).toBeGreaterThan(few.low);
    expect(many.high).toBeLessThan(few.high);
    expect(many.low).toBeLessThan(0.75);
    expect(many.high).toBeGreaterThan(0.75);
  });

  it("a clean sweep still has an interval below 100 %", () => {
    const p = summarize(["A", "B"], results("A", "B", 20, 20)).pairings[0]!;
    expect(p.share).toBe(1);
    expect(p.high).toBe(1);
    expect(p.low).toBeGreaterThan(0.8);
    expect(p.low).toBeLessThan(1);
  });

  it("with one seed pair knows nothing: [0, 1]", () => {
    const p = summarize(["A", "B"], results("A", "B", 2, 2)).pairings[0]!;
    expect([p.low, p.high]).toEqual([0, 1]);
  });

  it("counts game wins including shared ones", () => {
    const games = schedule(["A", "B"], 2, 1).map((g, i) => duel(g, i === 0 ? "A" : "draw"));
    const [a, b] = summarize(["A", "B"], games).bots;
    expect([a!.wins, b!.wins]).toEqual([2, 1]);
  });
});

describe("rate", () => {
  it("Equal bots", () => {
    const ratings = rate(summarize(["A", "B"], results("A", "B", 50, 100)));
    expect(ratings.get("A")).toBeCloseTo(1000, 6);
    expect(ratings.get("B")).toBeCloseTo(1000, 6);
  });

  it("Three quarters of the points", () => {
    const ratings = rate(summarize(["A", "B"], results("A", "B", 300, 400)), "B");
    const a = ratings.get("A")!;
    expect(ratings.get("B")).toBe(1000);
    expect(a).toBeLessThan(1000 + 400 * Math.log10(3));
    expect(a).toBeGreaterThan(1185);
  });

  it("Order does not matter", () => {
    const games = [...results("A", "B", 30, 40), ...results("A", "C", 10, 40), ...results("B", "C", 25, 40)];
    const reindexed = games.map((g, i) => ({ ...g, index: i }));
    const first = rate(summarize(["A", "B", "C"], reindexed));
    const second = rate(summarize(["A", "B", "C"], [...reindexed].reverse()));
    for (const bot of ["A", "B", "C"]) expect(second.get(bot)).toBeCloseTo(first.get(bot)!, 9);
  });

  it("Clean sweep", () => {
    const ratings = rate(summarize(["A", "B"], results("A", "B", 20, 20)), "B");
    expect(Number.isFinite(ratings.get("A"))).toBe(true);
    expect(ratings.get("A")).toBeGreaterThan(ratings.get("B")!);
  });

  it("anchors random when present, else the first bot", () => {
    expect(defaultAnchor(["greedy", "random"])).toBe("random");
    expect(defaultAnchor(["greedy", "search"])).toBe("greedy");
    const ratings = rate(summarize(["greedy", "random"], results("greedy", "random", 15, 20)));
    expect(ratings.get("random")).toBe(1000);
  });
});

describe("report and requirements", () => {
  const setup = { bots: ["random", "greedy"], format: "2 colours", gamesPerPairing: 20, firstSeed: 1, timeLimited: false, version: "abc1234" };

  it("Two-bot tournament", () => {
    const result = tournamentResult(setup, results("random", "greedy", 2, 20).reverse());
    expect(result.games.map((g) => g.index)).toEqual([...Array(20).keys()]);
    const report = markdownReport(result);
    const rows = report.split("\n").filter((l) => /^\| \d/.test(l));
    expect(rows[0]).toMatch(/^\| 1 \| greedy \| \d+ /);
    expect(rows[1]).toMatch(/^\| 2 \| random \| 1000 /);
    expect(report).toMatch(/\| \*\*greedy\*\* \| – \| 90\.0 % \(\d+\.\d %–\d+\.\d %\) \|/);
    expect(report).toContain("version abc1234");
    expect(report).not.toContain("Time-limited");
    expect(markdownReport(tournamentResult({ ...setup, timeLimited: true }, result.games))).toContain("Time-limited");
  });

  const requirement = { name: "greedy beats random", candidate: "greedy", baseline: "random", minShare: 0.9 };

  it("Requirement met", () => {
    const check = checkRequirement(requirement, summarize(["random", "greedy"], results("random", "greedy", 1, 40)));
    expect(check.passed).toBe(true);
    expect(check.share).toBeCloseTo(0.975);
    expect(check.line).toBe("PASS greedy beats random: 97.5 % ≥ 90.0 %");
  });

  it("Requirement missed", () => {
    const check = checkRequirement(requirement, summarize(["random", "greedy"], results("random", "greedy", 8, 40)));
    expect(check.passed).toBe(false);
    expect(check.line).toBe("FAIL greedy beats random: 80.0 % < 90.0 %");
  });
});
