import { z } from "zod";
import {
  type AutoplayPayload,
  BOT_SPEEDS,
  type BotSeatPayload,
  type JoinOptions,
  type KickPayload,
  MAX_SEATS,
  nicknameIssue,
  type RematchPayload,
  type SpeedPayload,
  type StartPayload,
  type WatchRequest,
} from "./codes.js";

/** A seat 1…MAX_SEATS. */
export const seatSchema = z.int().min(1).max(MAX_SEATS);

export const kickPayloadSchema = z.strictObject({ seat: seatSchema }) satisfies z.ZodType<KickPayload>;

export const botSeatPayloadSchema = z.strictObject({ seat: seatSchema }) satisfies z.ZodType<BotSeatPayload>;

export const speedPayloadSchema = z.strictObject({
  speed: z.literal(BOT_SPEEDS),
}) satisfies z.ZodType<SpeedPayload>;

export const autoplayPayloadSchema = z.strictObject({
  on: z.boolean(),
}) satisfies z.ZodType<AutoplayPayload>;

export const rematchPayloadSchema = z.strictObject({}) satisfies z.ZodType<RematchPayload>;

export const startPayloadSchema = z.strictObject({}) satisfies z.ZodType<StartPayload>;

/** A seated player's `move`, with the game's (strict) move schema. */
export function movePayloadSchema<S extends z.ZodType>(move: S) {
  return z.strictObject({ move });
}

/** The bot runner's `botMove`, with the game's move schema. */
export function botMovePayloadSchema<S extends z.ZodType>(move: S) {
  return z.strictObject({ seat: seatSchema, move });
}

/** The host's `setOptions`, with the game's (strict) options schema. */
export function optionsPayloadSchema<S extends z.ZodType>(options: S) {
  return z.strictObject({ options });
}

/** A nickname: trimmed, 2–16 code points, no control characters. Parses to the trimmed name; the issue message is a `NicknameIssue`. */
export const nicknameSchema = z
  .string()
  .trim()
  .superRefine((s, ctx) => {
    const issue = nicknameIssue(s);
    if (issue) ctx.addIssue({ code: "custom", message: issue });
  });

/**
 * Join options with the game's (strict) options schema. `watch` is a spectator joining a running
 * game through the watch route (games of bots to watch run on the device); `botSeats` are distinct
 * and leave at least one seat free. Unknown keys are refused, so an old app asking for something
 * this server does not know gets no game.
 */
export function joinOptionsSchema<S extends z.ZodType>(options: S) {
  return z
    .strictObject({
      nickname: nicknameSchema,
      pool: z.string().max(64).optional(),
      watch: z.boolean().optional(),
      botSeats: z.array(seatSchema).max(MAX_SEATS - 1).optional(),
      options: options.optional(),
    })
    .superRefine((o, ctx) => {
      if (o.botSeats && new Set(o.botSeats).size !== o.botSeats.length) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "seats repeat" });
      if (o.botSeats?.length && o.watch) ctx.addIssue({ code: "custom", path: ["botSeats"], message: "not when watching" });
    }) satisfies z.ZodType<JoinOptions<z.infer<S>>, unknown>;
}

export const watchRequestSchema = z.object({
  roomId: z.string().min(1).max(64),
  nickname: nicknameSchema,
}) satisfies z.ZodType<WatchRequest, unknown>;
