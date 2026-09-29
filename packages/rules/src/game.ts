import { botSeed, type BotView } from "./bot.js";
import type { Board } from "./board.js";
import type { Square } from "./geometry.js";
import { isReachable } from "./move.js";
import { createRng, MAX_SEED, type Rng } from "./rng.js";
import { setupBoard } from "./setup.js";
import { reverseOf, shiftBoard, type InsertionId } from "./shift.js";
import type { Rotation } from "./tile.js";
import type { TreasureId } from "./tileSet.js";
import { dealGame, firstSeat, homeSquare, settleMove } from "./treasures.js";
import { nextSeat, soleSurvivor } from "./turns.js";

/*
 * A whole game as plain, JSON-serialisable data, and the commands that change it. The same rule
 * checks as the server's game room, in the same order, with the same rejection codes; used where a
 * game runs without the server (quick games against bots on the device).
 */

export interface GameSeat {
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
  readonly pawn: Square;
  /** The whole treasure stack, in order; the target is `stack[found.length]`. */
  readonly stack: readonly TreasureId[];
  readonly found: readonly TreasureId[];
}

export type GameStep = "shift" | "move" | "finished";

export interface GameState {
  /** Seeds the board, the deal and the start seat; with the turn number, the bots' choices too. */
  readonly seed: number;
  readonly board: Board;
  /** Seated players in ascending seat order. */
  readonly seats: readonly GameSeat[];
  readonly step: GameStep;
  readonly turnSeat: number;
  /** Turns started so far (the first turn is 1). */
  readonly turn: number;
  readonly lastInsertion: InsertionId | undefined;
  /** The winning seat; 0 while the game runs. */
  readonly winnerSeat: number;
}

export interface NewSeat {
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
}

/** The server's codes for the ways a shift or move can be refused. */
export type GameRejection = "NOT_SEATED" | "WRONG_PHASE" | "NOT_YOUR_TURN" | "REVERSE_PUSH_FORBIDDEN" | "UNREACHABLE";

export type GameCommandResult = { ok: true; state: GameState } | { ok: false; code: GameRejection };

/**
 * A started game: deal (and board, unless one is given) from `seed`, pawns on their start
 * corners; the host on turn (else the drawn seat).
 */
export function startGame(seed: number, seats: readonly NewSeat[], hostSeat?: number, board: Board = setupBoard(seed)): GameState {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const { stacks, startSeat } = dealGame(
    seed,
    ordered.map((s) => s.seat),
  );
  return {
    seed,
    board,
    seats: ordered.map(({ seat, name, bot }) => ({ seat, name, bot, pawn: homeSquare(seat), stack: stacks.get(seat)!, found: [] })),
    step: "shift",
    turnSeat: firstSeat(hostSeat, ordered.map((s) => s.seat), startSeat),
    turn: 1,
    lastInsertion: undefined,
    winnerSeat: 0,
  };
}

/** The seat's current target; undefined once every card is found (heading home). */
export function targetOf(seat: GameSeat): TreasureId | undefined {
  return seat.stack[seat.found.length];
}

/** Rejects like the server: unseated, before a move in the wrong step, out of turn. */
function turnRejection(state: GameState, seat: number, step: "shift" | "move"): GameRejection | undefined {
  if (!state.seats.some((s) => s.seat === seat)) return "NOT_SEATED";
  if (state.step === "finished") return "WRONG_PHASE";
  if (seat !== state.turnSeat) return "NOT_YOUR_TURN";
  if (state.step !== step) return "WRONG_PHASE";
  return undefined;
}

/** The current player's shift: every pawn rides along, then the move step follows. */
export function applyShift(state: GameState, seat: number, insertion: InsertionId, rotation: Rotation): GameCommandResult {
  const code = turnRejection(state, seat, "shift");
  if (code) return { ok: false, code };
  if (state.lastInsertion !== undefined && insertion === reverseOf(state.lastInsertion)) return { ok: false, code: "REVERSE_PUSH_FORBIDDEN" };
  const { board, pawns } = shiftBoard(
    state.board,
    insertion,
    rotation,
    state.seats.map((s) => s.pawn),
  );
  return {
    ok: true,
    state: { ...state, board, seats: state.seats.map((s, i) => ({ ...s, pawn: pawns[i]! })), step: "move", lastInsertion: insertion },
  };
}

/** The current player's move (its own square = stay): collects, wins at home, or passes the turn. */
export function applyMove(state: GameState, seat: number, to: Square): GameCommandResult {
  const code = turnRejection(state, seat, "move");
  if (code) return { ok: false, code };
  const mover = state.seats.find((s) => s.seat === seat)!;
  if (!isReachable(state.board, mover.pawn, to)) return { ok: false, code: "UNREACHABLE" };
  const outcome = settleMove(state.board, { seat, square: to, target: targetOf(mover) });
  const moved: GameSeat = { ...mover, pawn: { row: to.row, col: to.col }, found: outcome.collected ? [...mover.found, outcome.collected] : mover.found };
  const seats = state.seats.map((s) => (s.seat === seat ? moved : s));
  if (outcome.won) return { ok: true, state: { ...state, seats, step: "finished", winnerSeat: seat } };
  const next = nextSeat(
    seats.map((s) => s.seat),
    seat,
  );
  return { ok: true, state: { ...state, seats, step: "shift", turnSeat: next, turn: state.turn + 1 } };
}

/**
 * A seat leaves a running game (left, kicked, timed out): its pawn and cards go. The last seat
 * standing wins; if the leaver was on turn, the next seat's turn starts.
 */
export function removeSeat(state: GameState, seat: number): GameState {
  if (state.step === "finished" || !state.seats.some((s) => s.seat === seat)) return state;
  const seats = state.seats.filter((s) => s.seat !== seat);
  const survivor = soleSurvivor(seats.map((s) => s.seat));
  if (survivor !== undefined) return { ...state, seats, step: "finished", winnerSeat: survivor };
  if (seat !== state.turnSeat) return { ...state, seats };
  const next = nextSeat(
    seats.map((s) => s.seat),
    seat,
  );
  return { ...state, seats, step: "shift", turnSeat: next, turn: state.turn + 1 };
}

/** Ends the game at once with `winnerSeat` (0: no winner, e.g. no person left). */
export function endGame(state: GameState, winnerSeat: number): GameState {
  return { ...state, step: "finished", winnerSeat };
}

/** What `seat` may fairly know: everything public plus its own target, never anyone else's. */
export function botViewOf(state: GameState, seat: number): BotView {
  const own = state.seats.find((s) => s.seat === seat);
  return {
    board: state.board,
    seat,
    seats: state.seats.map((s) => ({
      seat: s.seat,
      pawn: s.pawn,
      found: s.found.length,
      cardsLeft: s.stack.length - s.found.length,
      foundTreasures: s.found,
    })),
    lastInsertion: state.lastInsertion,
    target: own && targetOf(own),
  };
}

/** A bot's rng for the current turn: from the game seed, its seat and the turn, so nothing needs saving. */
export function botRngFor(state: GameState, seat: number): Rng {
  return createRng(botSeed((state.seed + Math.imul(state.turn, 0x2545f491)) >>> 0, seat) % (MAX_SEED + 1));
}
