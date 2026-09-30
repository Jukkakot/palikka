export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Events a kit client may report; a game adds its own. The server rejects any other name, so a new
 * client event must be added to the catalogue first.
 */
export const KIT_CLIENT_LOG_EVENTS = [
  "client.error",
  "client.warn",
  "client.info",
  "client.debug",
  "client.conn.lost",
  "client.conn.restored",
  "client.cmd.rejected",
  "client.local.started",
  "client.local.finished",
] as const;
export type KitClientLogEvent = (typeof KIT_CLIENT_LOG_EVENTS)[number];

/** Key events are shipped at info level even when not in debug mode. */
export const KIT_CLIENT_KEY_EVENTS: readonly KitClientLogEvent[] = [
  "client.conn.lost",
  "client.conn.restored",
  "client.cmd.rejected",
  "client.local.started",
  "client.local.finished",
];

export const CLIENT_LOG_LIMITS = {
  maxEntries: 50,
  maxMsg: 2000,
  maxStack: 8000,
  maxId: 64,
  maxFields: 20,
  maxFieldValue: 500,
} as const;
