/**
 * Version of the rules package. Server and client both report it so a
 * mismatch between a deployed server and a cached client is easy to spot.
 */
export const RULES_VERSION = "0.2.0";

export * from "./board.js";
export * from "./rng.js";
export * from "./turns.js";
export * from "./bot.js";
export * from "./game.js";
export * from "./daily.js";

// The real engine (not wired in yet; `game-room` switches to it and removes the placeholder above).
export * from "./pieces.js";
export * from "./config.js";
export * from "./moves.js";
export type { Bits } from "./bitboard.js";
export { checkPlacement, newPosition, type MoveRefusal, type Position } from "./position.js";
export * from "./movegen.js";
export * from "./play.js";
export * from "./scoring.js";
