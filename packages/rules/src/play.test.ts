import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CLASSIC, type BoardConfig } from "./config.js";
import { placement, positionWith } from "./engineFixtures.js";
import { hasLegalMove, legalMoves } from "./movegen.js";
import { encodeMove } from "./moves.js";
import { PIECE_COUNT, PIECE_SIZES, pieceNumber } from "./pieces.js";
import { abort, applyMove, pass } from "./play.js";
import { newPosition, type Position } from "./position.js";
import { randomGame } from "./reference.js";
import { scores, winners } from "./scoring.js";

function play(position: Position, colour: number, p: ReturnType<typeof placement>): Position {
  const result = applyMove(position, colour, p);
  if (!result.ok) throw new Error(result.code);
  return result.position;
}

/** A 3×3 board with three corners: small enough to get colours stuck by hand. */
const TINY: BoardConfig = { size: 3, starts: { 1: { row: 0, col: 0 }, 2: { row: 0, col: 2 }, 3: { row: 2, col: 2 } } };

describe("game-end-and-scoring › Turn order", () => {
  it("Three colours: after colour 2 comes colour 4", () => {
    const start = newPosition(CLASSIC, [1, 2, 4], 2);
    const next = play(start, 2, placement("I1", ["#"], 0, 19));
    expect(next.turn).toBe(4);
    expect(next.moveNumber).toBe(1);
    expect(play(next, 4, placement("I1", ["#"], 19, 0)).turn).toBe(1);
  });

  it("refuses a move out of turn and accepts move codes", () => {
    const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    expect(applyMove(start, 2, placement("I1", ["#"], 0, 19))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    const result = applyMove(start, 1, encodeMove(placement("I1", ["#"], 0, 0), 20));
    expect(result.ok && result.position.cells[0]).toBe(1);
  });

  it("returns the placement refusal and leaves the position untouched", () => {
    const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    expect(applyMove(start, 1, placement("I1", ["#"], 5, 5))).toEqual({ ok: false, code: "NOT_ON_START" });
    expect(start.cells.every((c) => c === 0)).toBe(true);
  });
});

describe("game-end-and-scoring › Automatic passing and end", () => {
  // Colour 1's I3 along the top row covers colour 2's start square.
  const afterBlock = play(newPosition(TINY, [1, 2, 3], 1), 1, placement("I3", ["###"], 0, 0));

  it("Stuck colour is skipped", () => {
    expect(afterBlock.out).toEqual([2]);
    expect(afterBlock.turn).toBe(3);
  });

  it("Out for good: colour 2 never gets the turn again", () => {
    const next = play(afterBlock, 3, placement("I1", ["#"], 2, 2));
    // Colour 1's corners (row 1) all touch its own row by an edge: stuck too.
    expect(next.out).toEqual([2, 1]);
    expect(next.turn).toBe(3);
  });

  it("Last colour stuck: the game has ended", () => {
    const next = play(afterBlock, 3, placement("I1", ["#"], 2, 2));
    // Colour 3 fills the last squares it may use; nothing is left for it.
    const last = play(next, 3, placement("V3", ["##", "#."], 1, 0));
    expect(last.ended).toBe(true);
    expect(last.turn).toBe(0);
    expect(last.out).toEqual([2, 1, 3]);
    expect(winners(last)).toEqual([3]);
  });

  it("No voluntary pass while a move exists", () => {
    const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    expect(pass(start, 1)).toEqual({ ok: false, code: "CANNOT_PASS" });
    expect(pass(start, 2)).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });

  it("the game can be ended from outside, with no winner", () => {
    const ended = abort(newPosition(CLASSIC, [1, 3], 1));
    expect(ended.ended && ended.aborted).toBe(true);
    expect(ended.turn).toBe(0);
    expect(winners(ended)).toEqual([]);
    expect(applyMove(ended, 1, placement("I1", ["#"], 0, 0))).toEqual({ ok: false, code: "GAME_OVER" });
    expect(pass(ended, 1)).toEqual({ ok: false, code: "GAME_OVER" });
  });

  it("random games: always end, out colours are stuck and never move again, scores match a recount", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.subarray([1, 2, 3, 4], { minLength: 2 }), (seed, colours) => {
        const games = randomGame(newPosition(CLASSIC, colours, colours[0]!), seed);
        const last = games.at(-1)!;
        expect(last.ended).toBe(true);
        expect(last.turn).toBe(0);
        expect([...last.out].sort()).toEqual(colours);
        for (let i = 1; i < games.length; i++) {
          const before = games[i - 1]!;
          const after = games[i]!;
          expect(after.out.slice(0, before.out.length)).toEqual(before.out);
          for (const colour of after.out.slice(before.out.length)) {
            const allPlaced = after.placed[colour]!.length === PIECE_COUNT;
            expect(allPlaced || !hasLegalMove(after, colour)).toBe(true);
          }
          if (after.turn !== 0) {
            expect(after.out).not.toContain(after.turn);
            expect(legalMoves(after, after.turn).length).toBeGreaterThan(0);
          }
        }
        for (const { colour, score, squares } of scores(last)) {
          const onBoard = last.cells.filter((c) => c === colour).length;
          expect(squares).toBe(onBoard);
          const all = last.placed[colour]!.length === PIECE_COUNT;
          expect(score).toBe(all ? (last.placed[colour]!.at(-1) === 0 ? 20 : 15) : onBoard - 89);
        }
        const best = Math.max(...scores(last).map((s) => s.score));
        expect(winners(last).length).toBeGreaterThan(0);
        for (const w of winners(last)) expect(scores(last).find((s) => s.colour === w)!.score).toBe(best);
      }),
      { numRuns: 20 },
    );
  });
});

describe("game-end-and-scoring › Score and Result", () => {
  const allBut = (...ids: string[]) => {
    const skip = new Set(ids.map(pieceNumber));
    return PIECE_SIZES.map((_, piece) => piece).filter((piece) => !skip.has(piece));
  };
  const withPlaced = (placed: Record<number, number[]>, ended = true): Position => ({
    ...newPosition(CLASSIC, Object.keys(placed).map(Number), Number(Object.keys(placed)[0])),
    placed,
    ended,
    turn: 0,
  });

  it("Pieces left over: I5, O4 and I1 unplaced → −10 with 79 squares", () => {
    expect(scores(withPlaced({ 1: allBut("I5", "O4", "I1") }))[0]).toEqual({ colour: 1, score: -10, squares: 79 });
  });

  it("All pieces placed, not the single square last → +15 with 89 squares", () => {
    expect(scores(withPlaced({ 1: [...allBut("I1"), 0].reverse() }))[0]).toEqual({ colour: 1, score: 15, squares: 89 });
  });

  it("Single square last → +20", () => {
    expect(scores(withPlaced({ 1: [...allBut("I1"), 0] }))[0]!.score).toBe(20);
  });

  it("Shared win: colours 1 and 3 both on −4", () => {
    const position = withPlaced({ 1: allBut("I4"), 2: allBut("I5", "I3"), 3: allBut("O4"), 4: allBut("L5") });
    expect(scores(position).map((s) => s.score)).toEqual([-4, -8, -4, -5]);
    expect(winners(position)).toEqual([1, 3]);
  });

  it("no winners while the game runs", () => {
    expect(winners(withPlaced({ 1: [], 3: [] }, false))).toEqual([]);
  });
});

describe("placement › fixtures", () => {
  it("positionWith builds a board without rule checks", () => {
    const position = positionWith([[1, placement("O4", ["##", "##"], 0, 0)]]);
    expect(position.cells.filter((c) => c === 1)).toHaveLength(4);
  });
});
