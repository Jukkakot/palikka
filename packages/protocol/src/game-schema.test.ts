import { describe, expect, it } from "vitest";
import {
  botPlacePayloadSchema,
  botSeatPayloadSchema,
  joinOptionsSchema,
  kickPayloadSchema,
  placePayloadSchema,
  nicknameSchema,
  autoplayPayloadSchema,
  rematchPayloadSchema,
  speedPayloadSchema,
  startPayloadSchema,
  watchRequestSchema,
} from "./game-schema.js";

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

describe("placePayloadSchema", () => {
  const ok = { piece: 0, orientation: 0, row: 0, col: 0 };

  it("accepts any piece, orientation and board square", () => {
    expect(placePayloadSchema.safeParse(ok).success).toBe(true);
    expect(placePayloadSchema.safeParse({ piece: 20, orientation: 7, row: 19, col: 3 }).success).toBe(true);
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
      expect(placePayloadSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("botPlacePayloadSchema", () => {
  it("accepts a seat 1–4 with a move and rejects anything else", () => {
    const move = { piece: 3, orientation: 1, row: 2, col: 2 };
    expect(botPlacePayloadSchema.safeParse({ seat: 2, ...move }).success).toBe(true);
    expect(botPlacePayloadSchema.safeParse({ seat: 0, ...move }).success).toBe(false);
    expect(botPlacePayloadSchema.safeParse({ seat: 5, ...move }).success).toBe(false);
    expect(botPlacePayloadSchema.safeParse(move).success).toBe(false);
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
    expect(joinOptionsSchema.parse({ nickname: " Pekka " })).toEqual({ nickname: "Pekka" });
    expect(joinOptionsSchema.safeParse({ nickname: "Pekka", pool: "e2e-1" }).success).toBe(true);
  });

  it("rejects a missing nickname", () => {
    expect(joinOptionsSchema.safeParse({}).success).toBe(false);
  });

  it("refuses the removed private, bots and speed options: games on the server are public and start without bots", () => {
    const ok = (o: object) => joinOptionsSchema.safeParse({ nickname: "Pekka", ...o }).success;
    expect(ok({ private: true })).toBe(false);
    expect(ok({ bots: 1 })).toBe(false);
    expect(ok({ watch: true, bots: 3, speed: 2 })).toBe(false);
    expect(ok({ watch: true })).toBe(true); // a spectator of a running game
  });

  it("accepts distinct bot seats for a rematch, not when watching", () => {
    const ok = (o: object) => joinOptionsSchema.safeParse({ nickname: "Pekka", ...o }).success;
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
