import { describe, expect, it } from "vitest";
import { botMovePayloadSchema, movePayloadSchema, optionsPayloadSchema } from "@game-kit/protocol";
import { joinOptionsSchema, moveSchema, optionsSchema } from "./game-schema.js";
import { VARIANT_IDS } from "./game-codes.js";

describe("moveSchema", () => {
  const ok = { piece: 0, orientation: 0, row: 0, col: 0 };

  it("accepts any piece, orientation and board square", () => {
    expect(moveSchema.safeParse(ok).success).toBe(true);
    expect(moveSchema.safeParse({ piece: 20, orientation: 7, row: 19, col: 3 }).success).toBe(true);
  });

  it("rejects out-of-range fields, non-integers, missing and extra fields", () => {
    for (const bad of [
      { ...ok, piece: 21 },
      { ...ok, piece: -1 },
      { ...ok, orientation: 8 },
      { ...ok, row: 20 },
      { ...ok, col: -1 },
      { ...ok, row: 1.5 },
      { ...ok, row: "1" },
      { piece: 0, row: 0, col: 0 },
      { ...ok, extra: 1 },
      { ...ok, seat: 1 },
      null,
    ]) {
      expect(moveSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("move and botMove with Palikka's move", () => {
  it("wrap a placement, the bot move with a seat 1–4", () => {
    const move = { piece: 3, orientation: 1, row: 2, col: 2 };
    expect(movePayloadSchema(moveSchema).safeParse({ move }).success).toBe(true);
    expect(movePayloadSchema(moveSchema).safeParse(move).success).toBe(false);
    expect(botMovePayloadSchema(moveSchema).safeParse({ seat: 2, move }).success).toBe(true);
    expect(botMovePayloadSchema(moveSchema).safeParse({ seat: 0, move }).success).toBe(false);
    expect(botMovePayloadSchema(moveSchema).safeParse({ seat: 5, move }).success).toBe(false);
    expect(botMovePayloadSchema(moveSchema).safeParse({ seat: 2, ...move }).success).toBe(false);
  });
});

describe("optionsSchema", () => {
  it("accepts the four variants and nothing else", () => {
    for (const variant of VARIANT_IDS) expect(optionsPayloadSchema(optionsSchema).safeParse({ options: { variant } }).success).toBe(true);
    expect(optionsSchema.safeParse({ variant: "junior" }).success).toBe(false);
    expect(optionsSchema.safeParse({}).success).toBe(false);
    expect(optionsSchema.safeParse({ variant: "duo", extra: 1 }).success).toBe(false);
  });

  it("join options take an optional variant (a rematch keeps it)", () => {
    expect(joinOptionsSchema.safeParse({ nickname: "Maija", options: { variant: "trio" } }).success).toBe(true);
    expect(joinOptionsSchema.safeParse({ nickname: "Maija", options: { variant: "junior" } }).success).toBe(false);
    expect(joinOptionsSchema.safeParse({ nickname: "Maija", variant: "trio" }).success).toBe(false);
  });
});
