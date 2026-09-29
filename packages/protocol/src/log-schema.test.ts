import { describe, expect, it } from "vitest";
import { CLIENT_LOG_LIMITS } from "./log-events.js";
import { clientLogBatchSchema } from "./log-schema.js";

const entry = { level: "error", evt: "client.error", ts: "2026-09-26T10:15:02.000Z", msg: "boom" } as const;

describe("clientLogBatchSchema", () => {
  it("accepts a valid batch", () => {
    expect(clientLogBatchSchema.safeParse({ ver: "a1b2c3d", entries: [entry] }).success).toBe(true);
  });

  it("rejects an oversized batch", () => {
    const entries = Array.from({ length: CLIENT_LOG_LIMITS.maxEntries + 1 }, () => entry);
    expect(clientLogBatchSchema.safeParse({ ver: "dev", entries }).success).toBe(false);
  });

  it("rejects unknown levels and event names", () => {
    expect(clientLogBatchSchema.safeParse({ ver: "dev", entries: [{ ...entry, level: "fatal" }] }).success).toBe(false);
    expect(clientLogBatchSchema.safeParse({ ver: "dev", entries: [{ ...entry, evt: "room.created" }] }).success).toBe(false);
  });

  it("rejects oversized fields", () => {
    const msg = "x".repeat(CLIENT_LOG_LIMITS.maxMsg + 1);
    expect(clientLogBatchSchema.safeParse({ ver: "dev", entries: [{ ...entry, msg }] }).success).toBe(false);
  });
});
