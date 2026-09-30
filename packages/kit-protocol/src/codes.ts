/** The most seats a kit game has. */
export const MAX_SEATS = 4;

/** A game needs at least this many seated players (people and bots) to start. */
export const MIN_SEATS = 2;

/** Game seeds are integers 0…MAX_GAME_SEED. */
export const MAX_GAME_SEED = 2 ** 32 - 1;

/** Seconds a turn may take before the other players may kick. */
export const TURN_TIME_LIMIT_SECONDS = 120;

/** Seconds a dropped player keeps their seat before being removed automatically. */
export const DISCONNECT_LIMIT_SECONDS = 300;

/** Error codes of the kit's commands, on top of `COMMON_ERROR_CODES`; a game adds its own. */
export const KIT_ERROR_CODES = [
  "NOT_SEATED",
  "NOT_YOUR_TURN",
  "WRONG_PHASE",
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
export type KitErrorCode = (typeof KIT_ERROR_CODES)[number];

/**
 * Game phases: "waiting" in the waiting room before the host starts, "play" while turns are played,
 * and "finished" once the game is over.
 */
export const TURN_PHASES = ["waiting", "play", "finished"] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

/** A seated player's `move`: the game's own move, checked by its move schema. */
export interface MovePayload<M> {
  move: M;
}

/** The bot runner's `botMove` for the bot-played `seat` on turn. */
export interface BotMovePayload<M> {
  seat: number;
  move: M;
}

/** The host's `setOptions` in the waiting room: the game's options (e.g. a variant). */
export interface OptionsPayload<O> {
  options: O;
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

/** Seat to kick: only the current player, once their turn time is up. */
export interface KickPayload {
  seat: number;
}

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

/** Options a client sends when it joins or creates a game room; `O` is the game's options. */
export interface JoinOptions<O = unknown> {
  nickname: string;
  /** Matchmaking pool; only E2E tests set it, so their games stay out of the real list. */
  pool?: string;
  /** The joiner watches a running game instead of taking a seat (games of bots to watch run on the device). */
  watch?: boolean;
  /** Seats that get a bot as soon as the room is created (a rematch keeps the finished game's bots). */
  botSeats?: number[];
  /** The game's options a room is created with (a rematch keeps the finished game's); the game's default when missing. */
  options?: O;
}

/** Listing metadata the lobby's game list shows and filters on. */
export interface GameMetadata<O = unknown> {
  /** The host's nickname; "" until the host has joined. */
  host: string;
  /** True while the game is in its waiting room. */
  open: boolean;
  /** Matchmaking pool: "" for real players, set by E2E tests. */
  pool: string;
  /** Seats taken by people and bots; the list shows it and hides a game with all seats taken. */
  seated: number;
  /** The game's options the host chose; the list shows them and takes the seat count from them. */
  options: O;
  /** True while the game runs and has room for another spectator: the start screen lists it to watch. */
  watchable: boolean;
}

/** Body of `POST /watch`: join a running game as a spectator. */
export interface WatchRequest {
  roomId: string;
  nickname: string;
}

/** Codes the server refuses a join or a room creation with (as the join error's message). */
export const JOIN_ERROR_CODES = ["INVALID_NICKNAME", "INVALID_OPTIONS", "SERVER_FULL", "NOT_WATCHABLE"] as const;
export type JoinErrorCode = (typeof JOIN_ERROR_CODES)[number];

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

export type KickRejection = "WRONG_PHASE" | "NOT_KICKABLE" | "TURN_NOT_EXPIRED";

export interface KickCheck {
  /** Seat of the player asking for the kick. */
  kicker: number;
  /** Seat named in the kick. */
  target: number;
  turnSeat: number;
  /** True once the current turn's time is up. */
  expired: boolean;
  /** True while the game is still in its waiting room. */
  waiting: boolean;
  finished: boolean;
}

/**
 * Why a kick is not allowed, or undefined when it is: only the current player, only by
 * someone else, only after their time is up, and never in the waiting room or a finished game.
 */
export function kickRejection({ kicker, target, turnSeat, expired, waiting, finished }: KickCheck): KickRejection | undefined {
  if (waiting || finished) return "WRONG_PHASE";
  if (target !== turnSeat || target === kicker) return "NOT_KICKABLE";
  if (!expired) return "TURN_NOT_EXPIRED";
  return undefined;
}
