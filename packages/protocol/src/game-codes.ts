import { KIT_ERROR_CODES } from "@game-kit/protocol";

// The kit's generic codes, payloads, join options, close codes and turn rules; Palikka's own follow.
export * from "@game-kit/protocol";

/**
 * Squares per board side, pieces per colour and most orientations per piece. They mirror the classic
 * board and the piece set in `@palikka/rules` (protocol must not depend on rules); a server test
 * keeps them equal.
 */
export const BOARD_CELLS_PER_SIDE = 20;
export const PIECES_PER_COLOUR = 21;
export const MAX_PIECE_ORIENTATIONS = 8;

/** Palikka's placement refusals, on top of the kit's codes. */
export const PLACEMENT_ERROR_CODES = ["PIECE_USED", "OFF_BOARD", "OVERLAP", "EDGE_CONTACT", "NOT_ON_START", "NO_CORNER_CONTACT"] as const;

/** Error codes of game commands, on top of `COMMON_ERROR_CODES`: the kit's and Palikka's placement codes. */
export const GAME_ERROR_CODES = [...KIT_ERROR_CODES, ...PLACEMENT_ERROR_CODES] as const;
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
