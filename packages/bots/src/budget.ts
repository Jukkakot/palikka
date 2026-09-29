import type { Budget, Clock } from "./types.js";

/** The platform clock (`performance.now` in browsers, workers and Node). */
export const systemClock: Clock = () => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now();

function isPositive(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Throws a RangeError unless the budget has at least one limit and every limit is positive. */
export function checkBudget(budget: Budget): void {
  const { timeMs, depth, iterations } = budget;
  if (timeMs !== undefined && !isPositive(timeMs)) throw new RangeError(`Budget timeMs must be positive, got ${timeMs}`);
  for (const [name, value] of [["depth", depth], ["iterations", iterations]] as const) {
    if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
      throw new RangeError(`Budget ${name} must be a positive integer, got ${value}`);
    }
  }
  if (timeMs === undefined && depth === undefined && iterations === undefined) {
    throw new RangeError("Budget needs timeMs, depth or iterations");
  }
}

/** A deadline check for a time budget; never expires without one. */
export function deadline(budget: Budget, now: Clock): () => boolean {
  if (budget.timeMs === undefined) return () => false;
  const end = now() + budget.timeMs;
  return () => now() >= end;
}
