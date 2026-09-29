import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chooseBotTurn, greedyBotTurn } from "./bot.js";
import { createBoard } from "./board.js";
import { sameSquare, square } from "./geometry.js";
import { applyMove, applyShift, botRngFor, botViewOf, endGame, removeSeat, startGame, targetOf, type GameState } from "./game.js";
import { reachableSquares } from "./move.js";
import { reverseOf } from "./shift.js";
import { homeSquare, tileOfTreasure } from "./treasures.js";

const ME = { seat: 1, name: "Maija", bot: false };
const ROBO = { seat: 2, name: "Robo", bot: true };
const PIXEL = { seat: 3, name: "Pixel", bot: true };
const BYTE = { seat: 4, name: "Byte", bot: true };

function ok(result: ReturnType<typeof applyShift>): GameState {
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

/** Plays the current seat's turn with the given strategy. */
function botTurn(state: GameState, strategy = greedyBotTurn): GameState {
  const turn = strategy(botViewOf(state, state.turnSeat), botRngFor(state, state.turnSeat));
  const shifted = ok(applyShift(state, state.turnSeat, turn.insertion, turn.rotation));
  return ok(applyMove(shifted, shifted.turnSeat, turn.to));
}

describe("startGame", () => {
  it("one against one: 12 cards each, pawns home, a seated seat on turn", () => {
    const state = startGame(7, [ROBO, ME]);
    expect(state.seats.map((s) => s.seat)).toEqual([1, 2]);
    expect(state.seats.map((s) => s.stack.length)).toEqual([12, 12]);
    expect(state.seats.every((s) => sameSquare(s.pawn, homeSquare(s.seat)))).toBe(true);
    expect([1, 2]).toContain(state.turnSeat);
    expect(state).toMatchObject({ step: "shift", turn: 1, winnerSeat: 0, lastInsertion: undefined });
  });

  it("First player starts: the host has the first turn whatever the seed draws", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) expect(startGame(seed, [ME, ROBO, PIXEL], 1).turnSeat).toBe(1);
  });

  it("one against three: 6 cards each, deterministic in the seed", () => {
    const a = startGame(42, [ME, ROBO, PIXEL, BYTE]);
    expect(a.seats.map((s) => s.stack.length)).toEqual([6, 6, 6, 6]);
    expect(startGame(42, [ME, ROBO, PIXEL, BYTE])).toEqual(a);
  });

  it("a given board is kept; the deal still comes from the seed", () => {
    const board = startGame(5, [ME, ROBO]).board;
    const state = startGame(42, [ME, ROBO], undefined, board);
    expect(state.board).toBe(board);
    expect(state.seats).toEqual(startGame(42, [ME, ROBO]).seats);
  });
});

describe("removeSeat and endGame", () => {
  const three = { ...startGame(3, [ME, ROBO, PIXEL]), turnSeat: 2 };

  it("a seat off turn leaves: the turn stays", () => {
    const state = removeSeat(three, 3);
    expect(state.seats.map((s) => s.seat)).toEqual([1, 2]);
    expect(state).toMatchObject({ step: "shift", turnSeat: 2, turn: 1 });
  });

  it("the seat on turn leaves mid-turn: the next seat's turn starts with a shift", () => {
    const state = removeSeat({ ...three, step: "move" }, 2);
    expect(state).toMatchObject({ step: "shift", turnSeat: 3, turn: 2 });
  });

  it("the last seat standing wins; a finished game or an unknown seat changes nothing", () => {
    const won = removeSeat(removeSeat(three, 3), 2);
    expect(won).toMatchObject({ step: "finished", winnerSeat: 1 });
    expect(removeSeat(won, 1)).toBe(won);
    expect(removeSeat(three, 4)).toBe(three);
  });

  it("endGame finishes with the given winner, 0 for none", () => {
    expect(endGame(three, 0)).toMatchObject({ step: "finished", winnerSeat: 0 });
  });
});

describe("applyShift and applyMove", () => {
  const base = { ...startGame(3, [ME, ROBO]), turnSeat: 1 };

  it("a shift moves to the move step and remembers the insertion", () => {
    const shifted = ok(applyShift(base, 1, "N1", 0));
    expect(shifted.step).toBe("move");
    expect(shifted.lastInsertion).toBe("N1");
    expect(shifted.board).not.toEqual(base.board);
  });

  it("rejects like the server, in the server's order", () => {
    expect(applyShift(base, 3, "N1", 0)).toEqual({ ok: false, code: "NOT_SEATED" });
    expect(applyShift(base, 2, "N1", 0)).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(applyMove(base, 1, homeSquare(1))).toEqual({ ok: false, code: "WRONG_PHASE" });
    const shifted = ok(applyShift(base, 1, "N1", 0));
    expect(applyShift(shifted, 1, "E1", 0)).toEqual({ ok: false, code: "WRONG_PHASE" });
    const far = reachableSquares(shifted.board, shifted.seats[0]!.pawn).length < 49 ? findUnreachable(shifted) : undefined;
    if (far) expect(applyMove(shifted, 1, far)).toEqual({ ok: false, code: "UNREACHABLE" });
    const moved = ok(applyMove(shifted, 1, shifted.seats[0]!.pawn));
    expect(applyShift(moved, 2, reverseOf("N1"), 0)).toEqual({ ok: false, code: "REVERSE_PUSH_FORBIDDEN" });
    const finished: GameState = { ...moved, step: "finished", winnerSeat: 1 };
    expect(applyShift(finished, 2, "N1", 0)).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("staying passes the turn to the next seat", () => {
    const shifted = ok(applyShift(base, 1, "N1", 0));
    const moved = ok(applyMove(shifted, 1, shifted.seats[0]!.pawn));
    expect(moved).toMatchObject({ step: "shift", turnSeat: 2, turn: 2 });
  });

  it("ending on the target's tile collects it and the next card becomes the target", () => {
    const state = withTargetUnder(base);
    const shifted = ok(applyShift(state, 1, "N1", 0));
    const me = shifted.seats[0]!;
    const target = targetOf(me)!;
    const squareOfTarget = shifted.board.squares.findIndex((t) => t.id === tileOfTreasure(target));
    const at = square(Math.floor(squareOfTarget / 7), squareOfTarget % 7);
    const moved = ok(applyMove(shifted, 1, at));
    expect(moved.seats[0]!.found).toEqual([target]);
    expect(targetOf(moved.seats[0]!)).toBe(me.stack[1]);
  });

  it("heading home and ending on the start corner wins", () => {
    const me = base.seats[0]!;
    const allFound: GameState = { ...base, seats: [{ ...me, found: me.stack }, base.seats[1]!] };
    const shifted = ok(applyShift(allFound, 1, "N3", 0));
    const moved = ok(applyMove(shifted, 1, homeSquare(1)));
    expect(moved).toMatchObject({ step: "finished", winnerSeat: 1 });
  });
});

describe("serialisation", () => {
  it("survives a JSON round trip, and play continues identically", () => {
    const state = botTurn(botTurn(startGame(11, [ME, ROBO, PIXEL])));
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    restored.board.squares.forEach((t) => expect(t).toHaveProperty("kind"));
    expect(createBoard(restored.board)).toEqual(state.board);
    expect(botTurn(restored)).toEqual(botTurn(state));
  });
});

describe("botViewOf", () => {
  it("shows only the bot's own target", () => {
    const state = startGame(5, [ME, ROBO, PIXEL]);
    const view = botViewOf(state, 2);
    expect(view.target).toBe(state.seats[1]!.stack[0]);
    expect(JSON.stringify(view.seats)).not.toContain("stack");
    expect(view.seats.map((s) => s.cardsLeft)).toEqual([8, 8, 8]);
  });
});

describe("whole games through the engine", () => {
  it("bot games stay legal and finish", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.integer({ min: 2, max: 4 }), (seed, count) => {
        let state = startGame(seed, [ME, ROBO, PIXEL, BYTE].slice(0, count));
        while (state.step !== "finished" && state.turn < 1500) state = botTurn(state, chooseBotTurn);
        expect(state.step).toBe("finished");
        const winner = state.seats.find((s) => s.seat === state.winnerSeat)!;
        expect(winner.found).toEqual(winner.stack);
        expect(sameSquare(winner.pawn, homeSquare(winner.seat))).toBe(true);
      }),
      { numRuns: 4 },
    );
  }, 60_000);
});

function findUnreachable(state: GameState) {
  const from = state.seats.find((s) => s.seat === state.turnSeat)!.pawn;
  const reach = reachableSquares(state.board, from);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 7; col++) if (!reach.some((s) => s.row === row && s.col === col)) return square(row, col);
  return undefined;
}

/**
 * The same game with seat 1's first target replaced by a treasure its pawn can reach after
 * shifting N1 with rotation 0 (any treasure it can reach, swapped into the stack's first place).
 */
function withTargetUnder(state: GameState): GameState {
  const shifted = ok(applyShift(state, 1, "N1", 0));
  const reach = reachableSquares(shifted.board, shifted.seats[0]!.pawn);
  const me = state.seats[0]!;
  const all = [...me.stack, ...state.seats[1]!.stack];
  const reachable = all.find((t) => {
    const i = shifted.board.squares.findIndex((tile) => tile.id === tileOfTreasure(t));
    return i >= 0 && reach.some((s) => s.row * 7 + s.col === i);
  });
  if (!reachable) throw new Error("no reachable treasure in this seed; pick another");
  const stack = [reachable, ...me.stack.filter((t) => t !== reachable)];
  return { ...state, seats: [{ ...me, stack }, state.seats[1]!] };
}
