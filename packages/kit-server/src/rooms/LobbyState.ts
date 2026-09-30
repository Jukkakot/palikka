import { schema, t, type Schema, type SchemaType } from "@colyseus/schema";

export const Player = schema({
  /** True for a computer-controlled seat (keyed `bot:<seat>`); a bot is always connected. */
  bot: t.boolean().default(false),
  /** True while the bot plays this person's seat (they handed it over, or their connection dropped). */
  autoplay: t.boolean().default(false),
  /** False while the player's connection is dropped and awaiting reconnection. */
  connected: t.boolean().default(true),
  /** 1…n in seat order. */
  seat: t.uint8().default(0),
  /** The player's nickname (trimmed, 2–16 characters). */
  name: t.string().default(""),
});
export type Player = SchemaType<typeof Player>;

/**
 * The synced state of a kit game room: the lobby (seats, host, phase, turn, clock, bots, spectators,
 * rematch), plus `game`, a child schema the game defines (its board, pieces …). The kit creates the
 * child and hands it to the game's `sync` / `reset`; it never reads inside it.
 */
export function lobbyStateOf<C extends Schema>(Game: new () => C) {
  return schema({
    /** Keyed by Colyseus sessionId, or `bot:<seat>` for a bot. */
    players: t.map(Player),
    /** The game's own synced data. */
    game: t.ref(Game),
    /** The seat of the player who plays the turn; 0 in the waiting room and once the game is over. */
    turnSeat: t.uint8().default(0),
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
}

/** The lobby state class for the game child `C`. */
export type LobbyStateClass<C extends Schema> = ReturnType<typeof lobbyStateOf<C>>;
/** The lobby state with the game child `C`. */
export type LobbyState<C extends Schema> = InstanceType<LobbyStateClass<C>>;
