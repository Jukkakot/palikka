import { clientLogBatchSchemaOf, clientLogEntrySchemaOf } from "@game-kit/protocol";
import { CLIENT_LOG_EVENTS } from "./log-events.js";

/** One client log entry of Palikka's catalogue. */
export const clientLogEntrySchema = clientLogEntrySchemaOf(CLIENT_LOG_EVENTS);

/** A batch of client log entries of Palikka's catalogue. */
export const clientLogBatchSchema = clientLogBatchSchemaOf(CLIENT_LOG_EVENTS);
