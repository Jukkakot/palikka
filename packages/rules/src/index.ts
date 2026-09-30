/**
 * Version of the rules package. Server and client both report it so a mismatch between a deployed
 * server and a cached client is easy to spot.
 */
export const RULES_VERSION = "1.1.0";

export * from "./rng.js";
export * from "./turns.js";
export * from "./pieces.js";
export * from "./config.js";
export * from "./moves.js";
export type { Bits } from "./bitboard.js";
export { checkPlacement, newPosition, withTurn, type MoveRefusal, type Position } from "./position.js";
export * from "./movegen.js";
export * from "./play.js";
export * from "./scoring.js";
export * from "./variants.js";
export * from "./game.js";
export * from "./bot.js";

// Bitboard helpers for bot evaluations (`bot-greedy`).
export { bitsToSquares, diagonalNeighbours, edgeNeighbours, emptyBits, rowMask } from "./bitboard.js";
