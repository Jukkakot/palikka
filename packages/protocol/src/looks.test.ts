import { describe, expect, it } from "vitest";
import { pickLook } from "./looks.js";
import { joinOptionsSchema, lookPayloadSchema } from "./game-schema.js";

describe("pawn-looks › Pawns given out in an online game", () => {
  it("Preferred pawn free: the preferred one", () => {
    expect(pickLook([1], 2, 3)).toBe(3);
  });

  it("Preferred pawn taken: the seat's own pawn", () => {
    expect(pickLook([3], 2, 3)).toBe(2);
  });

  it("Seat's pawn taken too: the lowest-numbered free pawn", () => {
    expect(pickLook([2], 2, 2)).toBe(1);
    expect(pickLook([1, 2, 4], 4)).toBe(3);
  });

  it("No preference: the seat's own pawn, as before", () => {
    expect(pickLook([1], 2)).toBe(2);
    expect(pickLook([], 1, 7)).toBe(1);
  });
});

describe("look schemas", () => {
  it("accepts 1–4 only, strictly", () => {
    expect(lookPayloadSchema.safeParse({ look: 4 }).success).toBe(true);
    expect(lookPayloadSchema.safeParse({ look: 0 }).success).toBe(false);
    expect(lookPayloadSchema.safeParse({ look: 2, seat: 1 }).success).toBe(false);
    expect(joinOptionsSchema.safeParse({ nickname: "Maija", look: 3 }).success).toBe(true);
    expect(joinOptionsSchema.safeParse({ nickname: "Maija", look: 5 }).success).toBe(false);
  });
});
