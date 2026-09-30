import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  autoplayPayloadSchema,
  botMovePayloadSchema,
  botSeatPayloadSchema,
  joinOptionsSchema,
  kickPayloadSchema,
  movePayloadSchema,
  nicknameSchema,
  optionsPayloadSchema,
  rematchPayloadSchema,
  speedPayloadSchema,
  startPayloadSchema,
  watchRequestSchema,
} from "./schema.js";

/** A game's options schema, as a game would pass it. */
const gameOptions = z.strictObject({ size: z.enum(["small", "large"]) });
const joinOptions = joinOptionsSchema(gameOptions);

describe("botSeatPayloadSchema", () => {
  it("accepts seats 1–4", () => {
    expect(botSeatPayloadSchema.safeParse({ seat: 1 }).success).toBe(true);
    expect(botSeatPayloadSchema.safeParse({ seat: 4 }).success).toBe(true);
  });

  it("rejects other seats, non-integers and extra fields", () => {
    expect(botSeatPayloadSchema.safeParse({ seat: 0 }).success).toBe(false);
    expect(botSeatPayloadSchema.safeParse({ seat: 5 }).success).toBe(false);
    expect(botSeatPayloadSchema.safeParse({ seat: 2.5 }).success).toBe(false);
    expect(botSeatPayloadSchema.safeParse({ seat: 2, name: "x" }).success).toBe(false);
    expect(botSeatPayloadSchema.safeParse(null).success).toBe(false);
  });
});

describe("kickPayloadSchema", () => {
  it("accepts seats 1–4", () => {
    expect(kickPayloadSchema.safeParse({ seat: 1 }).success).toBe(true);
    expect(kickPayloadSchema.safeParse({ seat: 4 }).success).toBe(true);
  });

  it("rejects other seats, non-integers and extra fields", () => {
    expect(kickPayloadSchema.safeParse({ seat: 0 }).success).toBe(false);
    expect(kickPayloadSchema.safeParse({ seat: 5 }).success).toBe(false);
    expect(kickPayloadSchema.safeParse({ seat: "1" }).success).toBe(false);
    expect(kickPayloadSchema.safeParse({ seat: 1, extra: 1 }).success).toBe(false);
  });
});

describe("nicknameSchema", () => {
  const issue = (value: unknown) => nicknameSchema.safeParse(value).error?.issues[0]?.message;

  it("accepts a valid nickname and trims it", () => {
    expect(nicknameSchema.parse("Maija")).toBe("Maija");
    expect(nicknameSchema.parse("  Maija  ")).toBe("Maija");
    expect(nicknameSchema.parse("Äö")).toBe("Äö");
  });

  it("counts code points, so 16 emoji fit", () => {
    expect(nicknameSchema.safeParse("🐉".repeat(16)).success).toBe(true);
    expect(issue("🐉".repeat(17))).toBe("length");
  });

  it("rejects too short and too long nicknames", () => {
    expect(issue("M")).toBe("length");
    expect(issue(" M ")).toBe("length");
    expect(issue("x".repeat(17))).toBe("length");
    expect(nicknameSchema.safeParse("x".repeat(16)).success).toBe(true);
  });

  it("rejects a whitespace-only nickname", () => {
    expect(issue("     ")).toBe("length");
  });

  it("rejects control characters", () => {
    expect(issue("Ma\u0000ija")).toBe("characters");
    expect(issue("Ma\nija")).toBe("characters");
    expect(issue("Ma\u007fija")).toBe("characters");
  });

  it("rejects a non-string", () => {
    expect(nicknameSchema.safeParse(undefined).success).toBe(false);
    expect(nicknameSchema.safeParse(42).success).toBe(false);
  });
});

describe("joinOptionsSchema", () => {
  it("accepts a nickname with an optional pool", () => {
    expect(joinOptions.parse({ nickname: " Pekka " })).toEqual({ nickname: "Pekka" });
    expect(joinOptions.safeParse({ nickname: "Pekka", pool: "e2e-1" }).success).toBe(true);
  });

  it("rejects a missing nickname", () => {
    expect(joinOptions.safeParse({}).success).toBe(false);
  });

  it("refuses the removed private, bots and speed options: games on the server are public and start without bots", () => {
    const ok = (o: object) => joinOptions.safeParse({ nickname: "Pekka", ...o }).success;
    expect(ok({ private: true })).toBe(false);
    expect(ok({ bots: 1 })).toBe(false);
    expect(ok({ watch: true, bots: 3, speed: 2 })).toBe(false);
    expect(ok({ watch: true })).toBe(true); // a spectator of a running game
  });

  it("accepts distinct bot seats for a rematch, not when watching", () => {
    const ok = (o: object) => joinOptions.safeParse({ nickname: "Pekka", ...o }).success;
    expect(ok({ botSeats: [2, 4] })).toBe(true);
    expect(ok({ botSeats: [] })).toBe(true);
    expect(ok({ botSeats: [2, 2] })).toBe(false);
    expect(ok({ botSeats: [1, 2, 3, 4] })).toBe(false);
    expect(ok({ botSeats: [5] })).toBe(false);
    expect(ok({ botSeats: [2], watch: true, bots: 2 })).toBe(false);
  });
});

describe("speedPayloadSchema and rematchPayloadSchema", () => {
  it("accepts the three speeds and an empty rematch", () => {
    for (const speed of [1, 2, 4]) expect(speedPayloadSchema.safeParse({ speed }).success).toBe(true);
    for (const speed of [0, 3, 8, "2"]) expect(speedPayloadSchema.safeParse({ speed }).success).toBe(false);
    expect(rematchPayloadSchema.safeParse({}).success).toBe(true);
    expect(rematchPayloadSchema.safeParse({ x: 1 }).success).toBe(false);
    expect(autoplayPayloadSchema.safeParse({ on: true }).success).toBe(true);
    for (const bad of [{}, { on: 1 }, { on: true, seat: 2 }]) expect(autoplayPayloadSchema.safeParse(bad).success).toBe(false);
  });
});

describe("watchRequestSchema", () => {
  it("needs a room id and a valid nickname", () => {
    expect(watchRequestSchema.parse({ roomId: "brave-otters-sing", nickname: " Maija " })).toEqual({ roomId: "brave-otters-sing", nickname: "Maija" });
    expect(watchRequestSchema.safeParse({ roomId: "", nickname: "Maija" }).success).toBe(false);
    expect(watchRequestSchema.safeParse({ roomId: "x", nickname: "M" }).success).toBe(false);
  });
});

describe("startPayloadSchema", () => {
  it("accepts only an empty object", () => {
    expect(startPayloadSchema.safeParse({}).success).toBe(true);
    expect(startPayloadSchema.safeParse({ seat: 1 }).success).toBe(false);
    expect(startPayloadSchema.safeParse(null).success).toBe(false);
  });
});

describe("game's move and options in the generic commands", () => {
  const move = z.strictObject({ col: z.int().min(0).max(6) });

  it("move, botMove and setOptions wrap the game's schemas and add nothing else", () => {
    expect(movePayloadSchema(move).safeParse({ move: { col: 3 } }).success).toBe(true);
    expect(movePayloadSchema(move).safeParse({ move: { col: 7 } }).success).toBe(false);
    expect(movePayloadSchema(move).safeParse({ col: 3 }).success).toBe(false);
    expect(movePayloadSchema(move).safeParse({ move: { col: 3 }, seat: 1 }).success).toBe(false);
    expect(botMovePayloadSchema(move).safeParse({ seat: 2, move: { col: 0 } }).success).toBe(true);
    for (const seat of [0, 5]) expect(botMovePayloadSchema(move).safeParse({ seat, move: { col: 0 } }).success).toBe(false);
    expect(botMovePayloadSchema(move).safeParse({ move: { col: 0 } }).success).toBe(false);
    expect(optionsPayloadSchema(gameOptions).safeParse({ options: { size: "small" } }).success).toBe(true);
    expect(optionsPayloadSchema(gameOptions).safeParse({ options: { size: "huge" } }).success).toBe(false);
    expect(optionsPayloadSchema(gameOptions).safeParse({ options: { size: "small", x: 1 } }).success).toBe(false);
  });

  it("join options take the game's options, strictly (a rematch keeps them)", () => {
    expect(joinOptions.safeParse({ nickname: "Maija", options: { size: "large" } }).success).toBe(true);
    expect(joinOptions.safeParse({ nickname: "Maija", options: { size: "huge" } }).success).toBe(false);
    expect(joinOptions.safeParse({ nickname: "Maija", options: { size: "large", x: 1 } }).success).toBe(false);
    expect(joinOptions.safeParse({ nickname: "Maija", size: "large" }).success).toBe(false);
  });
});
