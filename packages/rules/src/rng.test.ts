import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRng, MAX_SEED, shuffle } from "./rng.js";

const draw = (seed: number) => {
  const rng = createRng(seed);
  return Array.from({ length: 20 }, () => rng.int(0, 1000));
};

describe("board-setup › seeded randomness", () => {
  it("the same seed gives the same sequence", () => {
    expect(draw(42)).toEqual(draw(42));
  });

  it("different seeds give different sequences", () => {
    expect(draw(1)).not.toEqual(draw(2));
  });

  it("rejects invalid seeds", () => {
    for (const seed of [-1, MAX_SEED + 1, 1.5, Number.NaN]) {
      expect(() => createRng(seed)).toThrow(RangeError);
    }
    expect(() => createRng(0)).not.toThrow();
    expect(() => createRng(MAX_SEED)).not.toThrow();
  });

  it("int stays within bounds", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 5);
      expect(n >= 3 && n <= 5).toBe(true);
    }
  });

  it("property: shuffle is a permutation and deterministic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_SEED }), fc.array(fc.integer(), { maxLength: 60 }), (seed, items) => {
        const a = shuffle(createRng(seed), items);
        expect([...a].sort((x, y) => x - y)).toEqual([...items].sort((x, y) => x - y));
        expect(shuffle(createRng(seed), items)).toEqual(a);
      }),
    );
  });
});
