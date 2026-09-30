import { describe, expect, it } from "vitest";
import { kickRejection } from "./codes.js";

const base = { kicker: 2, target: 1, turnSeat: 1, expired: true, waiting: false, finished: false };

describe("turns › Kicking a slow player", () => {
  it("Kick after the time is up", () => {
    expect(kickRejection(base)).toBeUndefined();
  });

  it("Too early", () => {
    expect(kickRejection({ ...base, expired: false })).toBe("TURN_NOT_EXPIRED");
  });

  it("Turn already passed", () => {
    expect(kickRejection({ ...base, turnSeat: 3 })).toBe("NOT_KICKABLE");
  });

  it("Kicking yourself", () => {
    expect(kickRejection({ ...base, kicker: 1 })).toBe("NOT_KICKABLE");
  });

  it("rejects any kick in a finished game", () => {
    expect(kickRejection({ ...base, finished: true })).toBe("WRONG_PHASE");
  });

  it("rejects any kick in the waiting room", () => {
    expect(kickRejection({ ...base, waiting: true })).toBe("WRONG_PHASE");
  });
});
