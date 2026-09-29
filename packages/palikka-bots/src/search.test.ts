import { applyMove, CLASSIC, createRng, legalMoves, newPosition, PIECE_SIZES, decodeMove, encodeMove, type Position } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { brsPlayer, chooseMove, devicePlayer, greedyPlayer, mctsPlayer, palikkaGame, randomPlayer } from "./adapter.js";
import { playGame } from "./match.js";
import { moveKey } from "./moveKey.js";
import { parseBot, playTournamentGame, type TournamentBot } from "./tournament.js";
import { schedule } from "game-bots";

const opening = newPosition(CLASSIC, [1, 2, 3, 4], 1);
/** A mid-opening position: a few random moves in. */
const early: Position = playGame(opening, { 1: randomPlayer, 2: randomPlayer, 3: randomPlayer, 4: randomPlayer }, 4)[6]!;

describe("adapter › multi-player part", () => {
  it("a colour off turn gets the moves and results it would have on turn", () => {
    const colour = palikkaGame.players(early).find((c) => c !== early.turn)!;
    const onTurn = { ...early, turn: colour };
    const moves = palikkaGame.movesOf(early, colour);
    expect(moves).toEqual(legalMoves(onTurn, colour));
    const result = applyMove(onTurn, colour, moves[0]!);
    expect(result.ok && palikkaGame.playAs(early, colour, moves[0]!).cells).toEqual(result.ok && result.position.cells);
  });

  it("players still in, in turn order after the mover; none for out colours or an ended game", () => {
    expect(palikkaGame.players(opening)).toEqual([2, 3, 4, 1]);
    expect(palikkaGame.players({ ...opening, turn: 3, out: [4] })).toEqual([1, 2, 3]);
    expect(palikkaGame.movesOf({ ...opening, out: [2] }, 2)).toEqual([]);
    expect(palikkaGame.players({ ...opening, ended: true })).toEqual([]);
  });
});

describe("adapter › move key", () => {
  it("ranks a bigger piece higher", () => {
    const moves = legalMoves(opening, 1);
    const size = (code: number) => PIECE_SIZES[decodeMove(code, 20).piece]!;
    const best = moves.reduce((a, b) => (moveKey(opening, 1, b) > moveKey(opening, 1, a) ? b : a));
    expect(size(best)).toBe(5);
    const small = moves.find((m) => size(m) === 1)!;
    expect(moveKey(opening, 1, best)).toBeGreaterThan(moveKey(opening, 1, small));
  });

  it("ranks a move that covers an opponent's free corner higher than an equal one that does not", () => {
    // Colour 2's single square at (10,10) has a free corner at (11,11); colour 1's square at (12,12).
    const position = { ...positionWith([[2, placement("I1", ["#"], 10, 10)], [1, placement("I1", ["#"], 12, 12)]], [1, 2]), turn: 1 };
    const covering = encodeMove(placement("I2", ["##"], 11, 10), 20);
    const away = encodeMove(placement("I2", ["##"], 13, 13), 20);
    const codes = legalMoves(position, 1);
    expect(codes).toContain(covering);
    expect(codes).toContain(away);
    expect(moveKey(position, 1, covering)).toBeGreaterThan(moveKey(position, 1, away));
  });
});

describe("bot-search › search bots on Palikka", () => {
  it("both search bots play legal moves through a whole 4-colour game on small budgets", () => {
    for (const [bot, budget] of [
      [brsPlayer, { depth: 2 }],
      [mctsPlayer, { iterations: 30 }],
    ] as const) {
      const rng = createRng(3);
      let position = opening;
      while (!position.ended) {
        const colour = position.turn;
        const move = colour % 2 === 1 ? chooseMove(position, colour, budget, rng, bot) : chooseMove(position, colour, { depth: 1 }, rng, greedyPlayer);
        expect(move).toBeDefined();
        const result = applyMove(position, colour, move!);
        expect(result.ok).toBe(true);
        if (result.ok) position = result.position;
      }
    }
  }, 60_000);

  it("the device bot is the one chooseMove plays by default", () => {
    const budget = { depth: 2 };
    expect(chooseMove(early, early.turn, budget, 8)).toEqual(chooseMove(early, early.turn, budget, 8, devicePlayer));
  });

  it("Depth budget reproducible / Iteration budget reproducible on Palikka", () => {
    expect(chooseMove(early, early.turn, { depth: 2 }, 5, brsPlayer)).toEqual(chooseMove(early, early.turn, { depth: 2 }, 5, brsPlayer));
    expect(chooseMove(early, early.turn, { iterations: 40 }, 5, mctsPlayer)).toEqual(chooseMove(early, early.turn, { iterations: 40 }, 5, mctsPlayer));
  });
});

describe("bot-tournament › Bots are chosen by name and budget (search bots)", () => {
  it("Iteration budget", () => {
    expect(parseBot("mcts@i400").budget).toEqual({ iterations: 400 });
    expect(parseBot("brs").budget).toEqual({ depth: 2 });
    expect(parseBot("mcts").budget).toEqual({ iterations: 400 });
    expect(() => parseBot("mcts@i0")).toThrow(/at least 1/);
  });

  it("a 2-colour game between the search bots", () => {
    const players = new Map<string, TournamentBot>(["brs@d2", "mcts@i20"].map((l) => [l, parseBot(l)]));
    const [game] = schedule(["brs@d2", "mcts@i20"], 2, 1);
    expect(playTournamentGame(2, players, game!).result.scores).toHaveLength(2);
  }, 60_000);
});
