import { KIT_CLIENT_KEY_EVENTS, KIT_CLIENT_LOG_EVENTS } from "@game-kit/protocol";

export { CLIENT_LOG_LIMITS, LOG_LEVELS, type LogLevel } from "@game-kit/protocol";

/**
 * Events a client may report: the kit's, then Palikka's own. The server rejects any other name, so
 * a new client event must be added here first.
 */
export const CLIENT_LOG_EVENTS = [...KIT_CLIENT_LOG_EVENTS, "client.puzzle.solved"] as const;
export type ClientLogEvent = (typeof CLIENT_LOG_EVENTS)[number];

/** Key events are shipped at info level even when not in debug mode. */
export const CLIENT_KEY_EVENTS: readonly ClientLogEvent[] = [...KIT_CLIENT_KEY_EVENTS, "client.puzzle.solved"];
