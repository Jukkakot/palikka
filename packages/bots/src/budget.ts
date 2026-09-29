import type { Budget, Clock } from "./types.js";

/** The platform clock (`performance.now` in browsers, workers and Node). */
export const systemClock: Clock = () => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now();

function isPositive(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Throws a RangeError unless the budget has a positive time limit or depth (or both). */
export function checkBudget(budget: Budget): void {
  const { timeMs, depth } = budget;
  if (timeMs !== undefined && !isPositive(timeMs)) throw new RangeError(`Budget timeMs must be positive, got ${timeMs}`);
  if (depth !== undefined && !(Number.isInteger(depth) && depth > 0)) {
    throw new RangeError(`Budget depth must be a positive integer, got ${depth}`);
  }
  if (timeMs === undefined && depth === undefined) throw new RangeError("Budget needs timeMs or depth");
}

/** A deadline check for a time budget; never expires without one. */
export function deadline(budget: Budget, now: Clock): () => boolean {
  if (budget.timeMs === undefined) return () => false;
  const end = now() + budget.timeMs;
  return () => now() >= end;
}
