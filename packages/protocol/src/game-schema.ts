import { z } from "zod";
import { joinOptionsSchema as kitJoinOptionsSchema } from "@game-kit/protocol";
import {
  BOARD_CELLS_PER_SIDE,
  MAX_PIECE_ORIENTATIONS,
  PIECES_PER_COLOUR,
  type PalikkaOptions,
  type PlacePayload,
  VARIANT_IDS,
} from "./game-codes.js";

// The kit's generic payload schemas, next to Palikka's own.
export {
  autoplayPayloadSchema,
  botSeatPayloadSchema,
  kickPayloadSchema,
  nicknameSchema,
  rematchPayloadSchema,
  speedPayloadSchema,
  startPayloadSchema,
  watchRequestSchema,
} from "@game-kit/protocol";

const boardIndex = z.int().min(0).max(BOARD_CELLS_PER_SIDE - 1);

/** Palikka's move (in `move` and `botMove`): a piece in one orientation at a board square. */
export const moveSchema = z.strictObject({
  piece: z.int().min(0).max(PIECES_PER_COLOUR - 1),
  orientation: z.int().min(0).max(MAX_PIECE_ORIENTATIONS - 1),
  row: boardIndex,
  col: boardIndex,
}) satisfies z.ZodType<PlacePayload>;

/** Palikka's game options (in the join options, the listing and `setOptions`): the variant. */
export const optionsSchema = z.strictObject({
  variant: z.enum(VARIANT_IDS),
}) satisfies z.ZodType<PalikkaOptions>;

/**
 * Join options with Palikka's options. Unknown keys are refused, so an old app asking for a
 * private game or a game of bots gets no game.
 */
export const joinOptionsSchema = kitJoinOptionsSchema(optionsSchema);
