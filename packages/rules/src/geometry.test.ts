import { describe, expect, it } from "vitest";
import { ALL_SQUARES, directionTo, neighbour, opposite, rotateDirection, square } from "./geometry.js";

describe("board › Board geometry", () => {
  it("Neighbour in a direction", () => {
    expect(neighbour(square(3, 3), "E")).toEqual({ row: 3, col: 4 });
  });

  it("No neighbour beyond the edge", () => {
    expect(neighbour(square(0, 2), "N")).toBeUndefined();
  });

  it("Invalid coordinate", () => {
    expect(() => square(7, 0)).toThrow(RangeError);
    expect(() => square(-1, 3)).toThrow(RangeError);
    expect(() => square(2.5, 3)).toThrow(RangeError);
  });

  it("has 49 squares with (0,0) top-left", () => {
    expect(ALL_SQUARES).toHaveLength(49);
    expect(ALL_SQUARES[0]).toEqual({ row: 0, col: 0 });
    expect(ALL_SQUARES[48]).toEqual({ row: 6, col: 6 });
  });

  it("rotates directions clockwise and finds opposites", () => {
    expect(rotateDirection("N", 1)).toBe("E");
    expect(rotateDirection("W", 1)).toBe("N");
    expect(rotateDirection("N", -1)).toBe("W");
    expect(opposite("E")).toBe("W");
  });

  it("finds the direction between orthogonal neighbours only", () => {
    expect(directionTo(square(3, 3), square(2, 3))).toBe("N");
    expect(directionTo(square(3, 3), square(4, 4))).toBeUndefined();
  });
});
