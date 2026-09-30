/**
 * Squares per board side, pieces per colour and most orientations per piece. They mirror the classic
 * board and the piece set in `@palikka/rules` (protocol must not depend on rules); a server test
 * keeps them equal.
 */
export const BOARD_CELLS_PER_SIDE = 20;
export const PIECES_PER_COLOUR = 21;
export const MAX_PIECE_ORIENTATIONS = 8;

/** Error codes of game commands, on top of `COMMON_ERROR_CODES`. */
export const GAME_ERROR_CODES = [
  "NOT_SEATED",
  "NOT_YOUR_TURN",
  "WRONG_PHASE",
  "PIECE_USED",
  "OFF_BOARD",
  "OVERLAP",
  "EDGE_CONTACT",
  "NOT_ON_START",
  "NO_CORNER_CONTACT",
  "NOT_BOT_RUNNER",
  "NOT_BOT_SEAT",
  "NOT_KICKABLE",
  "TURN_NOT_EXPIRED",
  "NOT_HOST",
  "NOT_ENOUGH_PLAYERS",
  "TOO_MANY_PLAYERS",
  "SEAT_TAKEN",
  "NOT_A_BOT",
  "NOT_SPECTATOR",
  "PEOPLE_PLAYING",
  "AUTOPLAYING",
  "SERVER_FULL",
] as const;
export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];

/**
 * Game variants: Perus (classic), Duo, Tuplaväri (double: two colours each) and Kolmikko (trio: three
 * players and a shared colour). They mirror `VARIANT_IDS` in `@palikka/rules`; a server test keeps
 * them equal.
 */
export const VARIANT_IDS = ["classic", "duo", "double", "trio"] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

/** The host's `setVariant` command in the waiting room. */
export interface VariantPayload {
  variant: VariantId;
}

/**
 * Game phases: "waiting" in the waiting room before the host starts, "play" while turns are played,
 * and "finished" once the game is over.
 */
export const TURN_PHASES = ["waiting", "play", "finished"] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

/**
 * The move of the `place` command: a piece (0–20, the rules' piece number) in one of its
 * orientations, with the top-left of the orientation's bounding box at (row, col).
 */
export interface PlacePayload {
  piece: number;
  orientation: number;
  row: number;
  col: number;
}

/** The bot runner's move for the bot-played `seat` on turn. */
export interface BotPlacePayload extends PlacePayload {
  seat: number;
}

/** The `start` command has no fields: only the host sends it, in the waiting room. */
export type StartPayload = Record<string, never>;

/** Seat for the host's `addBot` / `removeBot` commands in the waiting room. */
export interface BotSeatPayload {
  seat: number;
}

/** Bot speeds a spectator can choose while only bots play: every pause of a bot's turn is divided by it. */
export const BOT_SPEEDS = [1, 2, 4] as const;
export type BotSpeed = (typeof BOT_SPEEDS)[number];

/** A spectator's `setSpeed` command. */
export interface SpeedPayload {
  speed: BotSpeed;
}

/** A seated player's `setAutoplay`: hand the own seat to the bot (`on`) or take it back. */
export interface AutoplayPayload {
  on: boolean;
}

/** The `rematch` command has no fields: a seated player sends it in a finished game. */
export type RematchPayload = Record<string, never>;

/** At most this many spectators watch one game. */
export const MAX_SPECTATORS = 8;

/** Bot names, language-neutral; a new bot gets the first one no other bot in the game has. */
export const BOT_NAMES = ["Kettu", "Ilves", "Pöllö", "Näätä"] as const;

/** Nickname length in code points, after trimming. */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

/** Why a nickname is invalid. */
export type NicknameIssue = "length" | "characters";

/**
 * The nickname rule, without zod so the client bundle can use it: after trimming, 2–16 code
 * points and no control characters. Undefined when `trimmed` (already trimmed) is valid.
 */
export function nicknameIssue(trimmed: string): NicknameIssue | undefined {
  const length = [...trimmed].length;
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) return "length";
  if (/\p{Cc}/u.test(trimmed)) return "characters";
  return undefined;
}

/** Options a client sends when it joins or creates a game room. */
export interface JoinOptions {
  nickname: string;
  /** Matchmaking pool; only E2E tests set it, so their games stay out of the real list. */
  pool?: string;
  /** The joiner watches a running game instead of taking a seat (games of bots to watch run on the device). */
  watch?: boolean;
  /** Seats that get a bot as soon as the room is created (a rematch keeps the finished game's bots). */
  botSeats?: number[];
  /** The variant a room is created with (a rematch keeps the finished game's); Perus when missing. */
  variant?: VariantId;
}

/** Body of `POST /watch`: join a running game as a spectator. */
export interface WatchRequest {
  roomId: string;
  nickname: string;
}

/** Codes the server refuses a join or a room creation with (as the join error's message). */
export const JOIN_ERROR_CODES = ["INVALID_NICKNAME", "INVALID_OPTIONS", "SERVER_FULL", "NOT_WATCHABLE"] as const;
export type JoinErrorCode = (typeof JOIN_ERROR_CODES)[number];

/** Seat to kick: only the current player, once their turn time is up. */
export interface KickPayload {
  seat: number;
}

/**
 * Close codes the server sends when it ends a player's connection itself.
 * Kept outside the 4000–4010 range Colyseus uses, so the SDK hands them to `onLeave` unchanged.
 */
export const CLOSE_CODES = {
  /** Removed by another player after the turn time ran out. */
  KICKED: 4100,
  /** The host left the waiting room, so the game was closed. */
  HOST_LEFT: 4101,
} as const;
