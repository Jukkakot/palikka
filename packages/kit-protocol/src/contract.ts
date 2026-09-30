/*
 * The game contract: what a turn-based game gives the kit. The rules part is pure and shared by
 * the server's room and the games on the device; the server part (`GameServerDefinition` in
 * `@game-kit/server`) and the client part (`GameClientDefinition` in `@game-kit/client`) add the
 * wire and the view. A seat is a player 1…n; the game decides everything inside a seat.
 */

/** Extra fields of a log line. */
export type LogFields = Record<string, unknown>;

/** A seated player as the game sees it. */
export interface Seat {
  /** 1…n. */
  readonly seat: number;
  readonly name: string;
  readonly bot: boolean;
}

/** A move's outcome: the new game, or a refusal code with the audit facts that explain it. */
export type PlayResult<G> = { ok: true; game: G } | { ok: false; code: string; facts?: LogFields };

/**
 * The rules of a game `G` (plain, JSON-serialisable data) with moves `M` and options `O` (for
 * example a variant). Pure: the same inputs always give the same result.
 */
export interface GameRules<G, M, O> {
  /** How many seats (people and bots) a game with `options` takes. */
  seatRange(options: O): { min: number; max: number };
  /** A new game for `seats` (ascending, within `seatRange`), seeded with `seed`. */
  start(seed: number, seats: readonly Seat[], options: O): G;
  /** The seat that plays the turn; 0 once nobody does (over). */
  seatOnTurn(game: G): number;
  /** Facts of the turn for `turn.changed` and `bot.fallback`, e.g. `{ colour }`. */
  turnFacts(game: G): LogFields;
  /** `seat` makes `move`. Refuses NOT_SEATED, WRONG_PHASE, NOT_YOUR_TURN or a game's own code. */
  play(game: G, seat: number, move: M): PlayResult<G>;
  /** `seat`'s player leaves the running game: the game decides what happens to the seat's things. */
  removeSeat(game: G, seat: number): G;
  isOver(game: G): boolean;
  /** The winning seats once over (several on a shared win); none with no winner. */
  winners(game: G): readonly number[];
  /** Nobody is left: the game ends at once with no winner. */
  end(game: G): G;
  /** The server's simple bot move for the seat on turn, seeded from the game; undefined if none. */
  fallbackMove(game: G): M | undefined;
  /** Facts of the end for `game.finished`, e.g. `{ scores }`. */
  finishFacts(game: G): LogFields;
  /** A short text of a refused move for the audit line. */
  moveText(move: M): string;
}
