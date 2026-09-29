/**
 * Catalogue of server log events. Add a name here before using it; the logger
 * only accepts these (client events come from @palikka/protocol).
 */
export const SERVER_LOG_EVENTS = [
  "server.started",
  "server.shutdown",
  "process.uncaughtException",
  "process.unhandledRejection",
  "framework.log",
  "http.request",
  "room.created",
  "room.disposed",
  "room.error",
  "room.closed",
  "room.refused",
  "game.started",
  "game.finished",
  "player.joined",
  "player.left",
  "player.dropped",
  "player.reconnected",
  "player.removed",
  "player.look",
  "bot.added",
  "bot.removed",
  "bot.fallback",
  "autoplay.changed",
  "spectator.joined",
  "spectator.left",
  "game.rematch",
  "turn.changed",
  "turn.expired",
  "phase.changed",
  "cmd.accepted",
  "cmd.rejected",
  "cmd.failed",
] as const;

export type ServerLogEvent = (typeof SERVER_LOG_EVENTS)[number];
