import { hasLegalMove } from "./movegen.js";
import { decodeMove, type Move, type Placement } from "./moves.js";
import { ORIENTATIONS, PIECE_COUNT } from "./pieces.js";
import { bitView, checkPlacement, rememberView, viewWith, type MoveRefusal, type Position } from "./position.js";

export type PlayResult = { ok: true; position: Position } | { ok: false; code: MoveRefusal };

/**
 * `colour` places a piece (readable form or move code). Validates turn, game over and the
 * placement, then advances the turn, marking colours out that are stuck or have placed everything,
 * and ends the game when every colour is out.
 */
export function applyMove(position: Position, colour: number, move: Placement | Move): PlayResult {
  if (position.ended) return { ok: false, code: "GAME_OVER" };
  if (colour !== position.turn) return { ok: false, code: "NOT_YOUR_TURN" };
  const placement = typeof move === "number" ? decodeMove(move, position.config.size) : move;
  const refusal = checkPlacement(position, colour, placement);
  if (refusal) return { ok: false, code: refusal };

  const { size } = position.config;
  const cells = [...position.cells];
  const orientation = ORIENTATIONS[placement.piece]![placement.orientation]!;
  for (const [r, c] of orientation.cells) cells[(placement.row + r) * size + placement.col + c] = colour;
  const pieces = [...position.placed[colour]!, placement.piece];
  const placed = { ...position.placed, [colour]: pieces };
  const out = pieces.length === PIECE_COUNT ? [...position.out, colour] : position.out;

  const next: Position = { ...position, cells, placed, out, moveNumber: position.moveNumber + 1 };
  rememberView(next, viewWith(bitView(position), colour, placement));
  return { ok: true, position: advanceTurn(next, colour) };
}

/**
 * Hands the turn to the next colour after `from` that can move, marking stuck colours out on the
 * way (`from` itself is checked last); ends the game when none can.
 */
function advanceTurn(position: Position, from: number): Position {
  const { colours } = position;
  const out = [...position.out];
  const start = colours.indexOf(from);
  for (let step = 1; step <= colours.length; step++) {
    const colour = colours[(start + step) % colours.length]!;
    if (out.includes(colour)) continue;
    if (hasLegalMove(position, colour)) return { ...position, out, turn: colour };
    out.push(colour);
  }
  return { ...position, out, turn: 0, ended: true };
}

/**
 * A voluntary pass. Never needed (stuck colours are passed automatically), so it is refused while
 * the colour has a legal move, which is always the case for the colour on turn.
 */
export function pass(position: Position, colour: number): PlayResult {
  if (position.ended) return { ok: false, code: "GAME_OVER" };
  if (colour !== position.turn) return { ok: false, code: "NOT_YOUR_TURN" };
  if (hasLegalMove(position, colour)) return { ok: false, code: "CANNOT_PASS" };
  return { ok: true, position: advanceTurn({ ...position, out: [...position.out, colour] }, colour) };
}

/**
 * `colour` leaves the running game (its player left or was removed): its squares stay and it is out
 * from now on; when it was on turn, the turn goes to the next colour that can move (the game ends
 * when none can). Unchanged for an ended game or a colour already out.
 */
export function resign(position: Position, colour: number): Position {
  if (position.ended || !position.colours.includes(colour) || position.out.includes(colour)) return position;
  const next = { ...position, out: [...position.out, colour] };
  return position.turn === colour ? advanceTurn(next, colour) : next;
}

/** Ends the game at once from outside (for example everyone left), with no winner. */
export function abort(position: Position): Position {
  return { ...position, turn: 0, ended: true, aborted: true };
}
