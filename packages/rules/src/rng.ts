import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

export const MAX_SEED = 2 ** 32 - 1;

/** A deterministic random source: the same seed always yields the same sequence. */
export interface Rng {
  /** Uniform integer in [min, max], both included. */
  int(min: number, max: number): number;
}

export function isValidSeed(seed: unknown): seed is number {
  return typeof seed === "number" && Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED;
}

export function createRng(seed: number): Rng {
  if (!isValidSeed(seed)) throw new RangeError(`Seed must be an integer 0…${MAX_SEED}, got ${seed}`);
  const generator = xoroshiro128plus(seed);
  return { int: (min, max) => uniformInt(generator, min, max) };
}

/** Fisher–Yates shuffle into a new array; the draw order is part of the reproducibility contract. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
