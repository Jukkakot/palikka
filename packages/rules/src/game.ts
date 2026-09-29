import { cellIndex, cellsOf, emptyBoard, isOnBoard, type Board, type Cell } from "./board.js";
import { botSeed, type BotView } from "./bot.js";
import { createRng, MAX_SEED, type Rng } from "./rng.js";
import { nextSeat, soleSurvivor } from "./turns.js";

/*
 * The placeholder game ("claim a cell"), kept until the real rules replace it: on their turn a player
 * claims one empty cell; after PLACEMENTS_PER_SEAT turns each, the most cells wins. It exists so the
 * whole chain (lobby, room, bots, device games, daily puzzle, end screen) runs end to end.
 *
 * A whole game as plain, JSON-serialisable data and the commands that change it; the server's room
 * and the games on the device both use it, with the same rejection codes.
 */

/** Turns each seat plays before the game ends. */
export const PLACEMENTS_PER_SEAT = 5;

export interface GameSeat {
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
  /** Cells claimed so far (turns played). */
  readonly placed: number;
}

export type GameStep = "play" | "finished";

export interface GameState {
  /** Seeds the start seat and, with the turn number, the bots' choices. */
  readonly seed: number;
  readonly board: Board;
  /** Seated players in ascending seat order. */
  readonly seats: readonly GameSeat[];
  readonly step: GameStep;
  readonly turnSeat: number;
  /** Turns started so far (the first turn is 1). */
  readonly turn: number;
  /** The winning seat; 0 while the game runs (and after a game nobody won). */
  readonly winnerSeat: number;
  /** Daily puzzle only: the cells to claim (indexes); the puzzle ends once all are claimed. */
  readonly targets?: readonly number[];
}

export interface NewSeat {
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
}

/** The server's codes for the ways a placement can be refused. */
export type GameRejection = "NOT_SEATED" | "WRONG_PHASE" | "NOT_YOUR_TURN" | "CELL_TAKEN" | "INVALID_COMMAND";

export type GameCommandResult = { ok: true; state: GameState } | { ok: false; code: GameRejection };

/** The first seat: the host when seated, else one drawn from the seed. */
function firstSeat(seed: number, seats: readonly number[], hostSeat?: number): number {
  if (hostSeat !== undefined && seats.includes(hostSeat)) return hostSeat;
  return seats[createRng(seed).int(0, seats.length - 1)]!;
}

/** A started game on an empty board: the host on turn (else a seat drawn from `seed`). */
export function startGame(seed: number, seats: readonly NewSeat[], hostSeat?: number): GameState {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  return {
    seed,
    board: emptyBoard(),
    seats: ordered.map(({ seat, name, bot }) => ({ seat, name, bot, placed: 0 })),
    step: "play",
    turnSeat: firstSeat(
      seed,
      ordered.map((s) => s.seat),
      hostSeat,
    ),
    turn: 1,
    winnerSeat: 0,
  };
}

/** The seat with the most cells; a tie goes to the lowest seat among them. 0 without seats. */
export function leader(state: { board: Board; seats: readonly { seat: number }[] }): number {
  let best = 0;
  let bestCells = -1;
  for (const { seat } of state.seats) {
    const cells = cellsOf(state.board, seat);
    if (cells > bestCells) {
      best = seat;
      bestCells = cells;
    }
  }
  return best;
}

/** The current player claims `cell`: the turn passes, or the game ends after everyone's last turn. */
export function applyPlace(state: GameState, seat: number, cell: Cell): GameCommandResult {
  if (!state.seats.some((s) => s.seat === seat)) return { ok: false, code: "NOT_SEATED" };
  if (state.step === "finished") return { ok: false, code: "WRONG_PHASE" };
  if (seat !== state.turnSeat) return { ok: false, code: "NOT_YOUR_TURN" };
  if (!isOnBoard(cell)) return { ok: false, code: "INVALID_COMMAND" };
  const index = cellIndex(cell);
  if (state.board[index] !== 0) return { ok: false, code: "CELL_TAKEN" };

  const board = state.board.map((owner, i) => (i === index ? seat : owner));
  const seats = state.seats.map((s) => (s.seat === seat ? { ...s, placed: s.placed + 1 } : s));
  if (state.targets) {
    // The daily puzzle ends once every target is claimed; the solving turn counts.
    const solved = state.targets.every((t) => board[t] === seat);
    return { ok: true, state: solved ? { ...state, board, seats, step: "finished", winnerSeat: seat } : { ...state, board, seats, turn: state.turn + 1 } };
  }
  if (seats.every((s) => s.placed >= PLACEMENTS_PER_SEAT)) {
    return { ok: true, state: { ...state, board, seats, step: "finished", winnerSeat: leader({ board, seats }) } };
  }
  const next = nextSeat(
    seats.filter((s) => s.placed < PLACEMENTS_PER_SEAT).map((s) => s.seat),
    seat,
  );
  return { ok: true, state: { ...state, board, seats, turnSeat: next, turn: state.turn + 1 } };
}

/**
 * A seat leaves a running game (left, kicked, timed out): its cells stay on the board. The last seat
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
  return { ...state, seats, turnSeat: next, turn: state.turn + 1 };
}

/** Ends the game at once with `winnerSeat` (0: no winner, e.g. no person left). */
export function endGame(state: GameState, winnerSeat: number): GameState {
  return { ...state, step: "finished", winnerSeat };
}

/** What `seat` may know when choosing: everything is public in this game. */
export function botViewOf(state: GameState, seat: number): BotView {
  return { board: state.board, seat, seats: state.seats.map((s) => ({ seat: s.seat, placed: s.placed })), targets: state.targets };
}

/** A bot's rng for the current turn: from the game seed, its seat and the turn, so nothing needs saving. */
export function botRngFor(state: GameState, seat: number): Rng {
  return createRng(botSeed((state.seed + Math.imul(state.turn, 0x2545f491)) >>> 0, seat) % (MAX_SEED + 1));
}
