// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearResume, loadResume, RESUME_HOLD_MS, saveResume } from "@game-kit/client";

beforeEach(() => localStorage.clear());

describe("game-session › Resume after closing the app (record)", () => {
  it("a record seen within the hold is offered; the same one is gone once cleared", () => {
    saveResume("tok", "brave-otters-sing", 1_000);
    expect(loadResume(1_000 + RESUME_HOLD_MS - 1)).toEqual({ token: "tok", roomId: "brave-otters-sing", seenAt: 1_000 });
    clearResume();
    expect(loadResume(1_000)).toBeUndefined();
  });

  it("Too late: a record older than the hold is dropped", () => {
    saveResume("tok", "r", 0);
    expect(loadResume(RESUME_HOLD_MS)).toBeUndefined();
    expect(localStorage.getItem("palikka.resume")).toBeNull();
  });

  it("a broken record is dropped", () => {
    localStorage.setItem("palikka.resume", "{not json");
    expect(loadResume()).toBeUndefined();
    localStorage.setItem("palikka.resume", JSON.stringify({ token: 1 }));
    expect(loadResume()).toBeUndefined();
    expect(localStorage.getItem("palikka.resume")).toBeNull();
  });

  it("blocked storage: nothing offered, nothing thrown", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => saveResume("t", "r", 0, blocked)).not.toThrow();
    expect(loadResume(0, blocked)).toBeUndefined();
  });
});
