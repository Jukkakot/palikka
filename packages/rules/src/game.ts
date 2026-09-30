import type { BoardConfig } from "./config.js";
import type { Placement } from "./moves.js";
import { abort, applyMove, resign } from "./play.js";
import { newPosition, type MoveRefusal, type Position } from "./position.js";
import { winners } from "./scoring.js";
import { VARIANTS, type VariantId } from "./variants.js";

/*
 * A whole game as plain, JSON-serialisable data: the variant, who sits in which seat, which seat
 * plays which colour, and the engine's position. The server's room and the games on the device both
 * run it, with the same rejection codes. A seat is a player; a colour is played by the seat in
 * `control` (in Perus the seat's own colour; the shared colour rotates among the seats).
 */

export interface GameSeat {
  /** 1–4. In Perus also the colour. */
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
}

export interface Game {
  readonly variant: VariantId;
  /** Seeds the bots' choices (with the move number), so nothing else needs saving. */
  readonly seed: number;
  /** Seated players in ascending seat order; a seat that left is gone from here. */
  readonly seats: readonly GameSeat[];
  /** Colour → the seat that plays it; 0 for the shared colour (see `controllerOf`). */
  readonly control: Readonly<Record<number, number>>;
  /** Seats whose player left the running game: their squares stay, their colours are out and they cannot win. */
  readonly left: readonly number[];
  readonly position: Position;
  /** Set once the game has ended: the seats with the best score among those that did not leave; [] with no winner. */
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

/**
 * A started game of `variant` on an empty board for `seats` (distinct seats 1–4); colour 1 (in Perus
 * the lowest seat's colour) has the first turn. Throws a RangeError for a player count the variant
 * does not take (callers check first and answer with a code). `board` overrides the variant's board
 * (tests only).
 */
export function startGame(seed: number, seats: readonly GameSeat[], variant: VariantId = "classic", board?: BoardConfig): Game {
  const definition = VARIANTS[variant];
  if (seats.length < definition.minPlayers) throw new RangeError(`${variant} needs at least ${definition.minPlayers} players`);
  if (seats.length > definition.maxPlayers) throw new RangeError(`${variant} takes at most ${definition.maxPlayers} players`);
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const groups = definition.colourGroups(ordered.map((s) => s.seat));
  const control: Record<number, number> = {};
  groups.forEach((colours, i) => {
    for (const colour of colours) control[colour] = ordered[i]!.seat;
  });
  if (definition.shared !== undefined) control[definition.shared] = 0;
  const colours = Object.keys(control).map(Number).sort((a, b) => a - b);
  const position = newPosition(board ?? definition.board, colours, colours[0]!, control);
  return { variant, seed, seats: ordered, control, left: [], position, winners: [] };
}

export function isFinished(game: Game): boolean {
  return game.position.ended;
}

/**
 * The seat that plays `colour` now: its owner, or for the shared colour the seats still in the game
 * in turn, one piece each (counted from the pieces it has placed); 0 when no one does.
 */
export function controllerOf(game: Game, colour: number): number {
  const owner = game.control[colour];
  if (owner === undefined) return 0;
  if (owner !== 0) return owner;
  const staying = game.seats.map((s) => s.seat);
  if (staying.length === 0) return 0;
  return staying[(game.position.placed[colour]?.length ?? 0) % staying.length]!;
}

/** The seat that plays the turn; 0 once the game has ended. */
export function seatOnTurn(game: Game): number {
  return game.position.ended ? 0 : controllerOf(game, game.position.turn);
}

/** The colours `seat` owns (not the shared colour), ascending. */
export function coloursOf(game: Game, seat: number): number[] {
  return game.position.colours.filter((c) => game.control[c] === seat);
}

/** The winners among the seats that did not leave, once the position has ended (none when aborted). */
function withResult(game: Game): Game {
  return { ...game, winners: winners(game.position, game.left) };
}

/** `seat` places a piece for the colour on turn. Checks seat, phase and turn, then the placement with the rules. */
export function playMove(game: Game, seat: number, move: Placement): GameResult {
  if (!game.seats.some((s) => s.seat === seat)) return { ok: false, code: "NOT_SEATED" };
  if (game.position.ended) return { ok: false, code: "WRONG_PHASE" };
  if (seatOnTurn(game) !== seat) return { ok: false, code: "NOT_YOUR_TURN" };
  const result = applyMove(game.position, game.position.turn, move);
  if (!result.ok) {
    const { code } = result;
    if (code === "GAME_OVER") return { ok: false, code: "WRONG_PHASE" };
    if (code === "INVALID_MOVE" || code === "CANNOT_PASS") return { ok: false, code: "INVALID_COMMAND" };
    return { ok: false, code };
  }
  return { ok: true, game: withResult({ ...game, position: result.position }) };
}

/**
 * `seat`'s player leaves the running game (left, kicked, timed out): its squares stay and all its
 * colours are out. The last seat standing wins at once; otherwise the turn moves on if it was theirs
 * (the shared colour goes on among the others).
 */
export function removeSeat(game: Game, seat: number): Game {
  if (game.position.ended || !game.seats.some((s) => s.seat === seat)) return game;
  const seats = game.seats.filter((s) => s.seat !== seat);
  const left = [...game.left, seat];
  const own = coloursOf(game, seat);
  if (seats.length === 1) {
    const position: Position = { ...game.position, out: [...new Set([...game.position.out, ...own])], turn: 0, ended: true };
    return { ...game, seats, left, position, winners: [seats[0]!.seat] };
  }
  const position = own.reduce((p, colour) => resign(p, colour), game.position);
  return withResult({ ...game, seats, left, position });
}

/** Ends the game at once with no winner (for example no person is left). */
export function endGame(game: Game): Game {
  if (game.position.ended) return game;
  return { ...game, position: abort(game.position), winners: [] };
}
