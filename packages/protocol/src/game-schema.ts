import { z } from "zod";
import { nicknameSchema, seatSchema } from "@game-kit/protocol";
import {
  BOARD_CELLS_PER_SIDE,
  MAX_PIECE_ORIENTATIONS,
  PIECES_PER_COLOUR,
  type BotPlacePayload,
  type JoinOptions,
  type PlacePayload,
  VARIANT_IDS,
  type VariantPayload,
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

const move = {
  piece: z.int().min(0).max(PIECES_PER_COLOUR - 1),
  orientation: z.int().min(0).max(MAX_PIECE_ORIENTATIONS - 1),
  row: boardIndex,
  col: boardIndex,
};

export const placePayloadSchema = z.strictObject(move) satisfies z.ZodType<PlacePayload>;

export const botPlacePayloadSchema = z.strictObject({
  seat: seatSchema,
  ...move,
}) satisfies z.ZodType<BotPlacePayload>;

export const variantPayloadSchema = z.strictObject({
  variant: z.enum(VARIANT_IDS),
}) satisfies z.ZodType<VariantPayload>;

/**
 * Join options. `watch` is a spectator joining a running game through the watch route (games of
 * bots to watch run on the device); `botSeats` are distinct and leave at least one seat free.
 * Unknown keys are refused, so an old app asking for a private game or a game of bots gets no game.
 */
export const joinOptionsSchema = z
  .strictObject({
    nickname: nicknameSchema,
    pool: z.string().max(64).optional(),
    watch: z.boolean().optional(),
    botSeats: z.array(seatSchema).max(3).optional(),
    variant: z.enum(VARIANT_IDS).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.botSeats && new Set(o.botSeats).size !== o.botSeats.length) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "seats repeat" });
    if (o.botSeats?.length && o.watch) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "not when watching" });
  }) satisfies z.ZodType<JoinOptions, unknown>;
