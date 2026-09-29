import { z } from "zod";
import {
  type AutoplayPayload,
  BOARD_CELLS_PER_SIDE,
  BOT_SPEEDS,
  nicknameIssue,
  type BotSeatPayload,
  type JoinOptions,
  type KickPayload,
  type PlacePayload,
  type RematchPayload,
  type SpeedPayload,
  type WatchRequest,
  type StartPayload,
} from "./game-codes.js";

const boardIndex = z.int().min(0).max(BOARD_CELLS_PER_SIDE - 1);

export const placePayloadSchema = z.strictObject({
  row: boardIndex,
  col: boardIndex,
}) satisfies z.ZodType<PlacePayload>;

export const kickPayloadSchema = z.strictObject({
  seat: z.int().min(1).max(4),
}) satisfies z.ZodType<KickPayload>;

export const botSeatPayloadSchema = z.strictObject({
  seat: z.int().min(1).max(4),
}) satisfies z.ZodType<BotSeatPayload>;

export const speedPayloadSchema = z.strictObject({
  speed: z.literal(BOT_SPEEDS),
}) satisfies z.ZodType<SpeedPayload>;

export const autoplayPayloadSchema = z.strictObject({
  on: z.boolean(),
}) satisfies z.ZodType<AutoplayPayload>;

export const rematchPayloadSchema = z.strictObject({}) satisfies z.ZodType<RematchPayload>;

export const startPayloadSchema = z.strictObject({}) satisfies z.ZodType<StartPayload>;

/** A nickname: trimmed, 2–16 code points, no control characters. Parses to the trimmed name; the issue message is a `NicknameIssue`. */
export const nicknameSchema = z
  .string()
  .trim()
  .superRefine((s, ctx) => {
    const issue = nicknameIssue(s);
    if (issue) ctx.addIssue({ code: "custom", message: issue });
  });

const seat = z.int().min(1).max(4);

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
    botSeats: z.array(seat).max(3).optional(),
  })
  .superRefine((o, ctx) => {
    if (o.botSeats && new Set(o.botSeats).size !== o.botSeats.length) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "seats repeat" });
    if (o.botSeats?.length && o.watch) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "not when watching" });
  }) satisfies z.ZodType<JoinOptions, unknown>;

export const watchRequestSchema = z.object({
  roomId: z.string().min(1).max(64),
  nickname: nicknameSchema,
}) satisfies z.ZodType<WatchRequest, unknown>;
