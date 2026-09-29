/**
 * Version of the rules package. Server and client both report it so a
 * mismatch between a deployed server and a cached client is easy to spot.
 */
export const RULES_VERSION = "0.1.0";

export * from "./geometry.js";
export * from "./tile.js";
export * from "./board.js";
export * from "./rng.js";
export * from "./tileSet.js";
export * from "./setup.js";
export * from "./shift.js";
export * from "./move.js";
export * from "./treasures.js";
export * from "./turns.js";
export * from "./bot.js";
export * from "./botHint.js";
export * from "./game.js";
export * from "./daily.js";
export * from "./dailySolver.js";
