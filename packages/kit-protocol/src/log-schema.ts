import { z } from "zod";
import { CLIENT_LOG_LIMITS, LOG_LEVELS } from "./log-events.js";

const L = CLIENT_LOG_LIMITS;

const fieldValue = z.union([z.string().max(L.maxFieldValue), z.number(), z.boolean(), z.null()]);

/** One client log entry, for a game's catalogue of client `events`. */
export function clientLogEntrySchemaOf<const E extends readonly [string, ...string[]]>(events: E) {
  return z.object({
    level: z.enum(LOG_LEVELS),
    evt: z.enum(events),
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
}

/** A client log entry of any catalogue (the server writes it as it came). */
export interface ClientLogEntry {
  level: (typeof LOG_LEVELS)[number];
  evt: string;
  ts: string;
  room?: string;
  player?: string;
  msg?: string;
  stack?: string;
  fields?: Record<string, string | number | boolean | null>;
}

/** A batch of client log entries, for a game's catalogue of client `events`. */
export function clientLogBatchSchemaOf<const E extends readonly [string, ...string[]]>(events: E) {
  return z.object({
    /** Build version of the client that sent the batch. */
    ver: z.string().min(1).max(L.maxId),
    entries: z.array(clientLogEntrySchemaOf(events)).min(1).max(L.maxEntries),
  });
}

/** What the server's client-log route needs: a schema that parses a batch. */
export interface ClientLogBatchParser {
  safeParse(input: unknown): { success: true; data: { ver: string; entries: ClientLogEntry[] } } | { success: false };
}
