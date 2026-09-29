import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { kickRejection, nextSeat, soleSurvivor } from "./turns.js";

const base = { kicker: 2, target: 1, turnSeat: 1, expired: true, waiting: false, finished: false };

describe("turns › Current player", () => {
  it("Current player leaves", () => {
    expect(nextSeat([1, 3], 2)).toBe(3);
  });

  it("Current player is kicked", () => {
    expect(nextSeat([2, 3], 1)).toBe(2);
  });

  it("wraps around clockwise and keeps a lone player", () => {
    expect(nextSeat([1, 2, 4], 4)).toBe(1);
    expect(nextSeat([3], 3)).toBe(3);
    expect(nextSeat([], 1)).toBe(0);
  });

  it("always returns a taken seat, or 0 when none is taken", () => {
    const seats = fc.uniqueArray(fc.integer({ min: 1, max: 4 }), { maxLength: 4 });
    fc.assert(
      fc.property(seats, fc.integer({ min: 0, max: 4 }), (taken, from) => {
        const next = nextSeat(taken, from);
        expect(taken.length === 0 ? next === 0 : taken.includes(next)).toBe(true);
      }),
    );
  });
});

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

describe("turns › Last player standing wins", () => {
  it("Opponent kicked", () => {
    expect(soleSurvivor([1])).toBe(1);
  });

  it("Two of three leave", () => {
    expect(soleSurvivor([1, 3])).toBeUndefined();
    expect(soleSurvivor([1])).toBe(1);
  });

  it("nobody left is no survivor", () => {
    expect(soleSurvivor([])).toBeUndefined();
  });
});
