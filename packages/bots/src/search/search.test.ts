import { describe, expect, it } from "vitest";
import { greedyBot } from "../players.js";
import type { Bot, Budget, MultiplayerGame } from "../types.js";
import { bestReplyBot } from "./brs.js";
import { mctsBot } from "./mcts.js";
import { A, C, grabEvaluate, grabGame, newGrab, steppingClock, testRng, TRAP, type Grab } from "./testing/grab.js";

const trap = newGrab(TRAP, 2);
const frozen = () => 0;

/** Many items so the tree does not fit in a small budget. */
const wide = newGrab(
  Array.from({ length: 14 }, (_, i) => ({ value: (i * 7) % 11, under: i >= 7 ? i - 7 : undefined })),
  3,
);

function playOut(bot: Bot<Grab, number>, start: Grab, budget: Budget, seed: number): number[] {
  const rng = testRng(seed);
  let state = start;
  const moves: number[] = [];
  while (!grabGame.isOver(state)) {
    const move = bot.choose(state, budget, rng);
    expect(move).toBeDefined();
    expect(grabGame.moves(state)).toContain(move);
    moves.push(move!);
    state = grabGame.play(state, move!);
  }
  return moves;
}

describe("best-reply search", () => {
  it("A move that loses to a reply is avoided", () => {
    expect(greedyBot(grabGame, grabEvaluate).choose(trap, { depth: 1 }, testRng(1))).toBe(A);
    expect(bestReplyBot(grabGame, grabEvaluate).choose(trap, { depth: 2 }, testRng(1))).toBe(C);
  });

  it("Only colours still in reply", () => {
    // Player 2 is out: it could punish A with B, but it never replies.
    const game: MultiplayerGame<Grab, number, number> = {
      ...grabGame,
      movesOf(s, p) {
        expect(p).not.toBe(2);
        return grabGame.movesOf(s, p);
      },
    };
    const state = newGrab(TRAP, 3, [1, 2]);
    expect(game.players(state)).toEqual([0]);
    const move = bestReplyBot(game, grabEvaluate).choose(state, { depth: 3 }, testRng(1));
    expect(grabGame.moves(state)).toContain(move);
    expect(move).toBe(A); // no one left to take B
  });

  it("depth 1 plays exactly the greedy move for the same seed", () => {
    const greedy = greedyBot(grabGame, grabEvaluate);
    const brs = bestReplyBot(grabGame, grabEvaluate);
    for (let seed = 1; seed <= 20; seed++) {
      expect(brs.choose(wide, { depth: 1 }, testRng(seed))).toBe(greedy.choose(wide, { depth: 1 }, testRng(seed)));
    }
  });

  it("Tiny time limit: a legal move, promptly", () => {
    const bot = bestReplyBot(grabGame, grabEvaluate, { now: steppingClock(1) });
    const move = bot.choose(wide, { timeMs: 1 }, testRng(3));
    expect(grabGame.moves(wide)).toContain(move);
  });

  it("Deeper when time allows", () => {
    const bot = bestReplyBot(grabGame, grabEvaluate, { now: frozen });
    expect(bot.choose(trap, { timeMs: 1000 }, testRng(1))).toBe(C);
  });

  it("time running out inside depth 2 keeps the depth-1 answer", () => {
    // The one-ply pass reads the clock twice (three moves); the deadline hits early in depth 2.
    const bot = bestReplyBot(grabGame, grabEvaluate, { now: steppingClock(1) });
    expect(bot.choose(trap, { timeMs: 4 }, testRng(1))).toBe(A);
  });

  it("Depth budget reproducible, and whole games stay legal", () => {
    const bot = bestReplyBot(grabGame, grabEvaluate);
    expect(playOut(bot, wide, { depth: 3 }, 5)).toEqual(playOut(bot, wide, { depth: 3 }, 5));
  });

  it("returns no move when the game is over", () => {
    const over = grabGame.play(grabGame.play(grabGame.play(trap, A), 1), C);
    expect(bestReplyBot(grabGame, grabEvaluate).choose(over, { depth: 2 }, testRng(1))).toBeUndefined();
  });
});

describe("MCTS", () => {
  it("avoids the move a reply punishes", () => {
    expect(mctsBot(grabGame, grabEvaluate).choose(trap, { iterations: 200 }, testRng(1))).toBe(C);
  });

  it("Iteration budget reproducible, and whole games stay legal", () => {
    const bot = mctsBot(grabGame, grabEvaluate);
    expect(playOut(bot, wide, { iterations: 200 }, 7)).toEqual(playOut(bot, wide, { iterations: 200 }, 7));
  });

  it("tiny time limit: the greedy answer", () => {
    const bot = mctsBot(grabGame, grabEvaluate, { now: steppingClock(1) });
    const greedy = greedyBot(grabGame, grabEvaluate, { now: steppingClock(1) });
    expect(bot.choose(wide, { timeMs: 1 }, testRng(4))).toBe(greedy.choose(wide, { timeMs: 1 }, testRng(4)));
  });

  it("players that are out never move in the tree", () => {
    const game: MultiplayerGame<Grab, number, number> = {
      ...grabGame,
      play(s, m) {
        expect(s.turn).not.toBe(1);
        return grabGame.play(s, m);
      },
    };
    const state = newGrab(TRAP.concat([{ value: 1 }, { value: 2 }]), 3, [1]);
    expect(grabGame.moves(state)).toContain(mctsBot(game, grabEvaluate).choose(state, { iterations: 100 }, testRng(2)));
  });
});
