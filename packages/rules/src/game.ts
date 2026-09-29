import { CLASSIC, type BoardConfig } from "./config.js";
import type { Placement } from "./moves.js";
import { abort, applyMove, resign } from "./play.js";
import { newPosition, type MoveRefusal, type Position } from "./position.js";
import { scores } from "./scoring.js";

/*
 * A whole game as plain, JSON-serialisable data: who sits in which seat (a seat is also its colour)
 * and the engine's position. The server's room and the games on the device both run it, with the
 * same rejection codes.
 */

export interface GameSeat {
  /** 1–4; also the colour. */
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
}

export interface Game {
  /** Seeds the bots' choices (with the move number), so nothing else needs saving. */
  readonly seed: number;
  /** Seated players in ascending seat order; a seat that left is gone from here. */
  readonly seats: readonly GameSeat[];
  /** Colours whose player left the running game: their squares stay, they are out and cannot win. */
  readonly left: readonly number[];
  readonly position: Position;
  /** Set once the game has ended: the colours with the best score among those that did not leave; [] with no winner. */
  readonly winners: readonly number[];
}

/** Why a move was refused: the room's own codes, then the engine's placement refusals. */
export type GameRejection =
  | "NOT_SEATED"
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "INVALID_COMMAND"
  | Exclude<MoveRefusal, "GAME_OVER" | "INVALID_MOVE" | "CANNOT_PASS" | "NOT_YOUR_TURN">;

export type GameResult = { ok: true; game: Game } | { ok: false; code: GameRejection };

/** A started game on an empty board for `seats` (distinct seats 1–4); the lowest seat has the first turn. */
export function startGame(seed: number, seats: readonly GameSeat[], config: BoardConfig = CLASSIC): Game {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const colours = ordered.map((s) => s.seat);
  return { seed, seats: ordered, left: [], position: newPosition(config, colours, colours[0]!), winners: [] };
}

export function isFinished(game: Game): boolean {
  return game.position.ended;
}

/** The winners among the colours that did not leave, once the position has ended (none when aborted). */
function withResult(game: Game): Game {
  const { position } = game;
  if (!position.ended || position.aborted) return { ...game, winners: [] };
  const staying = scores(position).filter((s) => !game.left.includes(s.colour));
  const best = Math.max(...staying.map((s) => s.score));
  return { ...game, winners: staying.filter((s) => s.score === best).map((s) => s.colour) };
}

/** `seat` places a piece. Checks seat, phase and turn, then the placement with the rules. */
export function playMove(game: Game, seat: number, move: Placement): GameResult {
  if (!game.seats.some((s) => s.seat === seat)) return { ok: false, code: "NOT_SEATED" };
  const result = applyMove(game.position, seat, move);
  if (!result.ok) {
    const { code } = result;
    if (code === "GAME_OVER") return { ok: false, code: "WRONG_PHASE" };
    if (code === "INVALID_MOVE" || code === "CANNOT_PASS") return { ok: false, code: "INVALID_COMMAND" };
    return { ok: false, code };
  }
  return { ok: true, game: withResult({ ...game, position: result.position }) };
}

/**
 * `seat`'s player leaves the running game (left, kicked, timed out): its squares stay and its colour
 * is out. The last seat standing wins at once; otherwise the turn moves on if it was theirs.
 */
export function removeSeat(game: Game, seat: number): Game {
  if (game.position.ended || !game.seats.some((s) => s.seat === seat)) return game;
  const seats = game.seats.filter((s) => s.seat !== seat);
  const left = [...game.left, seat];
  if (seats.length === 1) {
    const position: Position = { ...game.position, out: [...new Set([...game.position.out, seat])], turn: 0, ended: true };
    return { ...game, seats, left, position, winners: [seats[0]!.seat] };
  }
  return withResult({ ...game, seats, left, position: resign(game.position, seat) });
}

/** Ends the game at once with no winner (for example no person is left). */
export function endGame(game: Game): Game {
  if (game.position.ended) return game;
  return { ...game, position: abort(game.position), winners: [] };
}
