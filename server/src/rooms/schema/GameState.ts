import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema({
  /** True for a computer-controlled seat (keyed `bot:<seat>`); a bot is always connected. */
  bot: t.boolean().default(false),
  /** True while the bot plays this person's seat (they handed it over, or their connection dropped). */
  autoplay: t.boolean().default(false),
  /** False while the player's connection is dropped and awaiting reconnection. */
  connected: t.boolean().default(true),
  /** 1–4, clockwise from the top-left corner; also the player's colour. */
  seat: t.uint8().default(0),
  /** The player's nickname (trimmed, 2–16 characters). */
  name: t.string().default(""),
  /** Turns played so far. */
  placed: t.uint8().default(0),
});
export type Player = SchemaType<typeof Player>;

export const GameState = schema({
  /** Keyed by Colyseus sessionId, or `bot:<seat>` for a bot. */
  players: t.map(Player),
  /** Owner seat of every cell (0 = empty), row-major, 20×20. */
  cells: t.array("uint8"),
  /** Seat 1–4 of the current player; 0 in the waiting room. */
  turnSeat: t.uint8().default(0),
  /** "waiting" before the start, "play" while turns are played, "finished" once the game is over. */
  phase: t.string().default("waiting"),
  /** Seat of the host, the player who created the game and may start it; 0 until someone joins. */
  hostSeat: t.uint8().default(0),
  /** Seat of the winner; 0 while the game runs. */
  winnerSeat: t.uint8().default(0),
  /** Turns started so far (the first turn is 1); 0 in the waiting room. */
  turn: t.uint16().default(0),
  /** When the current turn's time runs out (server epoch ms); 0 while no clock runs. For the countdown only. */
  turnDeadline: t.float64().default(0),
  /** True once the current turn's time is up: from then on the other players may kick. */
  turnExpired: t.boolean().default(false),
  /** How many spectators watch (dropped ones still in their hold included). */
  spectators: t.uint8().default(0),
  /** Bot speed 1, 2 or 4: every pause of a bot's turn is divided by it. */
  botSpeed: t.uint8().default(1),
  /** Id of the rematch game created from this finished game; "" until someone asks for one. */
  rematchRoomId: t.string().default(""),
});
export type GameState = SchemaType<typeof GameState>;
