import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema({
  /** True for a computer-controlled seat (keyed `bot:<seat>`); a bot is always connected. */
  bot: t.boolean().default(false),
  /** True while the bot plays this person's seat (they handed it over, or their connection dropped). */
  autoplay: t.boolean().default(false),
  /** False while the player's connection is dropped and awaiting reconnection. */
  connected: t.boolean().default(true),
  /** 1–4, clockwise from the top-left corner; in Perus also the player's colour (see `ColourState.seat`). */
  seat: t.uint8().default(0),
  /** The player's nickname (trimmed, 2–16 characters). */
  name: t.string().default(""),
});
export type Player = SchemaType<typeof Player>;

/** One colour of the running game as the rules engine holds it; stays after its player left. */
export const ColourState = schema({
  /** 1–4. */
  colour: t.uint8().default(0),
  /** The seat that plays it (in Perus the colour itself); 0 for the shared colour, played in turn. */
  seat: t.uint8().default(0),
  /** Placed piece numbers (0–20) in placement order: they give the score (the last one counts too). */
  pieces: t.array("uint8"),
  /** The colour cannot move any more (stuck, all pieces placed, or left). */
  out: t.boolean().default(false),
  /** The colour's player left the running game: its squares stay, they cannot win. */
  left: t.boolean().default(false),
});
export type ColourState = SchemaType<typeof ColourState>;

export const GameState = schema({
  /** Keyed by Colyseus sessionId, or `bot:<seat>` for a bot. */
  players: t.map(Player),
  /** The variant: "classic", "duo", "double" or "trio"; the host sets it in the waiting room. */
  variant: t.string().default("classic"),
  /** Owner colour of every square (0 = empty), row-major, board size × board size (20×20, Duo 14×14). */
  cells: t.array("uint8"),
  /** The colours of the started game in ascending order; empty in the waiting room. */
  colours: t.array(ColourState),
  /** Seat 1–4 of the player who plays the turn; 0 in the waiting room and once the game is over. */
  turnSeat: t.uint8().default(0),
  /** The colour on turn (played by `turnSeat`); 0 in the waiting room and once the game is over. */
  turnColour: t.uint8().default(0),
  /** "waiting" before the start, "play" while turns are played, "finished" once the game is over. */
  phase: t.string().default("waiting"),
  /** Seat of the host, the player who created the game and may start it; 0 until someone joins. */
  hostSeat: t.uint8().default(0),
  /** The winning seats once the game is over (several on a shared win); empty with no winner. */
  winners: t.array("uint8"),
  /** Turns started so far (the first turn is 1); 0 in the waiting room. */
  turn: t.uint16().default(0),
  /** When the current turn's time runs out (server epoch ms); 0 while no clock runs. For the countdown only. */
  turnDeadline: t.float64().default(0),
  /** True once the current turn's time is up: from then on the other players may kick. */
  turnExpired: t.boolean().default(false),
  /** The seat whose browser computes the bots' moves; 0 = none (the server plays them). */
  botRunnerSeat: t.uint8().default(0),
  /** How many spectators watch (dropped ones still in their hold included). */
  spectators: t.uint8().default(0),
  /** Bot speed 1, 2 or 4: every pause of a bot's turn is divided by it. */
  botSpeed: t.uint8().default(1),
  /** Id of the rematch game created from this finished game; "" until someone asks for one. */
  rematchRoomId: t.string().default(""),
});
export type GameState = SchemaType<typeof GameState>;
