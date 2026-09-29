/**
 * Insertion points for the `shift` command. Mirrors `INSERTIONS` in
 * `@labyrinth/rules` (protocol must not depend on rules); a server test keeps
 * the two lists equal.
 */
export const INSERTION_IDS = ["N1", "N3", "N5", "E1", "E3", "E5", "S1", "S3", "S5", "W1", "W3", "W5"] as const;
export type InsertionIdCode = (typeof INSERTION_IDS)[number];

/** Clockwise tile rotations in degrees. */
export const ROTATION_VALUES = [0, 90, 180, 270] as const;

/** Error codes of game commands, on top of `COMMON_ERROR_CODES`. */
export const GAME_ERROR_CODES = [
  "NOT_SEATED",
  "NOT_YOUR_TURN",
  "WRONG_PHASE",
  "REVERSE_PUSH_FORBIDDEN",
  "UNREACHABLE",
  "NOT_KICKABLE",
  "TURN_NOT_EXPIRED",
  "NOT_HOST",
  "NOT_ENOUGH_PLAYERS",
  "SEAT_TAKEN",
  "NOT_A_BOT",
  "NOT_SPECTATOR",
  "PEOPLE_PLAYING",
  "AUTOPLAYING",
  "SERVER_FULL",
  "LOOK_TAKEN",
] as const;
export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];

/**
 * Game phases: "waiting" in the waiting room before the host starts, then each turn's steps (the
 * current player shifts, then moves or stays), and "finished" once someone has won.
 */
export const TURN_PHASES = ["waiting", "shift", "move", "finished"] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

export interface ShiftPayload {
  insertion: InsertionIdCode;
  rotation: (typeof ROTATION_VALUES)[number];
}

/** Target square of the `move` command; the pawn's own square means "stay". */
export interface MovePayload {
  row: number;
  col: number;
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
export const BOT_NAMES = ["Robo", "Pixel", "Byte", "Nova"] as const;

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
  /** The pawn (1–4) the player would like; they get it when nobody in the game has it. */
  look?: number;
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
