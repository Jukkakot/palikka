import { describe, expect, it } from "vitest";
import { CLASSIC } from "./config.js";
import { placement, positionWith } from "./engineFixtures.js";
import { legalMoves } from "./movegen.js";
import { applyMove } from "./play.js";
import { bitView, checkPlacement, newPosition, withTurn } from "./position.js";

const I1 = (row: number, col: number) => placement("I1", ["#"], row, col);
const I2h = (row: number, col: number) => placement("I2", ["##"], row, col);

describe("placement › Board and start corners", () => {
  it("Two colours on the classic board: each keeps its own corner", () => {
    const position = newPosition(CLASSIC, [3, 1], 1);
    expect(position.colours).toEqual([1, 3]);
    expect(checkPlacement(position, 1, I1(0, 0))).toBeUndefined();
    expect(checkPlacement(position, 3, I1(19, 19))).toBeUndefined();
    expect(checkPlacement(position, 3, I1(0, 19))).toBe("NOT_ON_START");
  });

  it("refuses a colour without a start square or a first colour outside the game", () => {
    expect(() => newPosition(CLASSIC, [1, 5], 1)).toThrow(RangeError);
    expect(() => newPosition(CLASSIC, [1, 3], 2)).toThrow(RangeError);
  });
});

describe("placement › A legal placement", () => {
  const afterMonomino = positionWith([[1, I1(0, 0)]]);

  it("First piece must cover the start corner", () => {
    const position = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    expect(checkPlacement(position, 1, I1(0, 1))).toBe("NOT_ON_START");
    expect(checkPlacement(position, 1, placement("L4", ["#..", "###"], 0, 0))).toBeUndefined();
  });

  it("Corner contact continues the colour", () => {
    expect(checkPlacement(afterMonomino, 1, I2h(1, 1))).toBeUndefined();
  });

  it("Edge contact with the own colour is refused, even with diagonal contact too", () => {
    expect(checkPlacement(afterMonomino, 1, I2h(0, 1))).toBe("EDGE_CONTACT");
    expect(checkPlacement(afterMonomino, 1, I2h(1, 0))).toBe("EDGE_CONTACT");
  });

  it("No contact with the own colour", () => {
    expect(checkPlacement(afterMonomino, 1, I2h(5, 5))).toBe("NO_CORNER_CONTACT");
  });

  it("Other colours may be touched", () => {
    const position = positionWith([
      [1, I1(0, 0)],
      [2, I2h(2, 1)],
      [2, placement("I3", ["#", "#", "#"], 0, 3)],
    ]);
    // Shares edges with colour 2 below and to the right, touches its own square diagonally.
    expect(checkPlacement(position, 1, I2h(1, 1))).toBeUndefined();
  });

  it("Overlap and outside", () => {
    const position = positionWith([
      [1, I1(0, 0)],
      [2, I1(1, 1)],
    ]);
    expect(checkPlacement(position, 1, I2h(1, 1))).toBe("OVERLAP");
    expect(checkPlacement(position, 1, I2h(19, 19))).toBe("OFF_BOARD");
    expect(checkPlacement(position, 1, I2h(-1, 3))).toBe("OFF_BOARD");
  });

  it("A piece is used once", () => {
    expect(checkPlacement(afterMonomino, 1, I1(1, 1))).toBe("PIECE_USED");
  });

  it("refuses malformed placements", () => {
    expect(checkPlacement(afterMonomino, 1, { piece: 21, orientation: 0, row: 1, col: 1 })).toBe("INVALID_MOVE");
    expect(checkPlacement(afterMonomino, 1, { piece: 0, orientation: 1, row: 1, col: 1 })).toBe("INVALID_MOVE");
    expect(checkPlacement(afterMonomino, 1, { piece: 1, orientation: 0, row: 1.5, col: 1 })).toBe("INVALID_MOVE");
    expect(checkPlacement(afterMonomino, 5, I2h(1, 1))).toBe("INVALID_MOVE");
  });
});

describe("placement › Refusal reasons", () => {
  it("Several faults: overlap wins over edge contact", () => {
    const position = positionWith([
      [1, I1(0, 0)],
      [2, I1(0, 1)],
    ]);
    expect(checkPlacement(position, 1, I2h(0, 1))).toBe("OVERLAP");
  });

  it("piece used wins over outside", () => {
    expect(checkPlacement(positionWith([[1, I1(0, 0)]]), 1, I1(-5, 0))).toBe("PIECE_USED");
  });
});

describe("withTurn", () => {
  it("gives a colour off turn the moves and results it would have on turn, keeping the bitboards", () => {
    const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    const after = applyMove(start, 1, legalMoves(start, 1)[0]!);
    if (!after.ok) throw new Error(after.code);
    const position = after.position;
    expect(position.turn).toBe(2);
    const view = bitView(position);
    const asThree = withTurn(position, 3);
    expect(asThree.turn).toBe(3);
    expect(bitView(asThree)).toBe(view);
    expect(withTurn(position, 2)).toBe(position);
    const moves = legalMoves(asThree, 3);
    expect(moves).toEqual(legalMoves({ ...position, turn: 3 }, 3));
    const played = applyMove(asThree, 3, moves[0]!);
    expect(played.ok).toBe(true);
    expect(applyMove(position, 3, moves[0]!)).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
  });
});
