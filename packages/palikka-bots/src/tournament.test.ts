import { schedule } from "game-bots";
import { describe, expect, it } from "vitest";
import { parseBot, playTournamentGame, type TournamentBot } from "./tournament.js";

const bots = (...labels: string[]) => new Map<string, TournamentBot>(labels.map((l) => [l, parseBot(l)]));

describe("bot-tournament › Bots are chosen by name and budget", () => {
  it("Budget in the name", () => {
    expect(parseBot("greedy@200ms").budget).toEqual({ timeMs: 200 });
    expect(parseBot("greedy@d2").budget).toEqual({ depth: 2 });
    expect(parseBot("random").budget).toEqual({ depth: 1 });
    expect(parseBot("greedy@200ms").label).toBe("greedy@200ms");
  });

  it("Unknown bot", () => {
    expect(() => parseBot("kettu")).toThrow(/Unknown bot "kettu"\. Known bots: random, greedy/);
    expect(() => parseBot("greedy@fast")).toThrow(/not valid.*Known bots: random, greedy/);
    expect(() => parseBot("greedy@0ms")).toThrow(/at least 1/);
  });
});

describe("bot-tournament › Matches rotate seats fairly", () => {
  it("4 colours: the first bot on 1 and 3, swapped on 2 and 4", () => {
    const [plain, swapped] = schedule(["random", "greedy"], 2, 5);
    expect(playTournamentGame(4, bots("random", "greedy"), plain!).result.seats).toEqual(["random", "greedy", "random", "greedy"]);
    expect(playTournamentGame(4, bots("random", "greedy"), swapped!).result.seats).toEqual(["greedy", "random", "greedy", "random"]);
  });

  it("2 colours: colours 1 and 2", () => {
    const [plain, swapped] = schedule(["random", "greedy"], 2, 5);
    const game = playTournamentGame(2, bots("random", "greedy"), plain!);
    expect(game.result.seats).toEqual(["random", "greedy"]);
    expect(game.result.scores).toHaveLength(2);
    expect(playTournamentGame(2, bots("random", "greedy"), swapped!).result.seats).toEqual(["greedy", "random"]);
  });

  it("times every move of every bot", () => {
    const [game] = schedule(["random", "greedy"], 2, 1);
    const { timing } = playTournamentGame(4, bots("random", "greedy"), game!);
    expect(timing.greedy!.moves).toBeGreaterThan(10);
    expect(timing.random!.moves).toBeGreaterThan(10);
    expect(timing.greedy!.maxMs).toBeGreaterThanOrEqual(timing.greedy!.totalMs / timing.greedy!.moves);
  });
});

describe("bot-tournament › Tournaments are reproducible", () => {
  it("Same run twice", () => {
    const players = bots("random", "greedy");
    const games = schedule(["random", "greedy"], 2, 3);
    const forward = games.map((g) => playTournamentGame(4, players, g).result);
    const backward = [...games].reverse().map((g) => playTournamentGame(4, players, g).result).reverse();
    expect(backward).toEqual(forward);
  }, 20_000);
});
