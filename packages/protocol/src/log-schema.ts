import { z } from "zod";
import { CLIENT_LOG_EVENTS, CLIENT_LOG_LIMITS, LOG_LEVELS } from "./log-events.js";

const L = CLIENT_LOG_LIMITS;

const fieldValue = z.union([z.string().max(L.maxFieldValue), z.number(), z.boolean(), z.null()]);

export const clientLogEntrySchema = z.object({
  level: z.enum(LOG_LEVELS),
  evt: z.enum(CLIENT_LOG_EVENTS),
  /** Client clock, ISO 8601. */
  ts: z.iso.datetime(),
  room: z.string().max(L.maxId).optional(),
  player: z.string().max(L.maxId).optional(),
  msg: z.string().max(L.maxMsg).optional(),
  stack: z.string().max(L.maxStack).optional(),
  fields: z
    .record(z.string().max(L.maxId), fieldValue)
    .refine((f) => Object.keys(f).length <= L.maxFields, { message: "too many fields" })
    .optional(),
});
export type ClientLogEntry = z.infer<typeof clientLogEntrySchema>;

export const clientLogBatchSchema = z.object({
  /** Build version of the client that sent the batch. */
  ver: z.string().min(1).max(L.maxId),
  entries: z.array(clientLogEntrySchema).min(1).max(L.maxEntries),
});
export type ClientLogBatch = z.infer<typeof clientLogBatchSchema>;
