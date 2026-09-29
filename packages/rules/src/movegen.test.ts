import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bitsToSquares } from "./bitboard.js";
import { CLASSIC } from "./config.js";
import { placement, positionWith } from "./engineFixtures.js";
import { forbiddenSquares, freeCorners, hasLegalMove, legalMoves } from "./movegen.js";
import { decodeMove, encodeMove } from "./moves.js";
import { MAX_ORIENTATIONS, ORIENTATIONS, PIECE_COUNT } from "./pieces.js";
import { checkPlacement, newPosition } from "./position.js";
import { randomGame, referenceMoves } from "./reference.js";

const sorted = (moves: readonly number[]) => [...moves].sort((a, b) => a - b);

describe("placement › Complete list of legal moves", () => {
  it("Opening moves: 58 moves, all covering the top-left corner", () => {
    const position = newPosition(CLASSIC, [1, 2, 3, 4], 1);
    const moves = legalMoves(position, 1);
    expect(moves).toHaveLength(58);
    for (const code of moves) {
      const p = decodeMove(code, 20);
      expect(ORIENTATIONS[p.piece]![p.orientation]!.cells.some(([r, c]) => p.row + r === 0 && p.col + c === 0)).toBe(true);
    }
    for (const colour of [2, 3, 4]) expect(legalMoves(position, colour)).toHaveLength(58);
  });

  it("Matches the definition: fast list equals the reference list along random games", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.subarray([1, 2, 3, 4], { minLength: 2 }), (seed, colours) => {
        const games = randomGame(newPosition(CLASSIC, colours, colours[0]!), seed);
        games.forEach((position, index) => {
          // Every colour, not only the one on turn; every third position keeps the run fast.
          if (index % 3 !== 0) return;
          for (const colour of colours) {
            const fast = legalMoves(position, colour);
            expect(new Set(fast).size).toBe(fast.length);
            expect(sorted(fast)).toEqual(sorted(referenceMoves(position, colour)));
            expect(legalMoves(position, colour)).toEqual(fast);
            expect(hasLegalMove(position, colour)).toBe(fast.length > 0);
          }
        });
      }),
      { numRuns: 6 },
    );
  });

  it("any placement is legal exactly when it is listed", () => {
    const positions = randomGame(newPosition(CLASSIC, [1, 2, 3, 4], 1), 7);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: positions.length - 1 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: PIECE_COUNT - 1 }),
        fc.integer({ min: 0, max: MAX_ORIENTATIONS - 1 }),
        fc.integer({ min: -2, max: 21 }),
        fc.integer({ min: -2, max: 21 }),
        (at, colour, piece, orientation, row, col) => {
          const position = positions[at]!;
          const placement = { piece, orientation, row, col };
          const refusal = checkPlacement(position, colour, placement);
          const valid = orientation < ORIENTATIONS[piece]!.length && row >= 0 && col >= 0 && row < 20 && col < 20;
          const listed = valid && legalMoves(position, colour).includes(encodeMove(placement, 20));
          expect(refusal === undefined).toBe(listed);
        },
      ),
      { numRuns: 3000 },
    );
  });

  it("Encoding round trip", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: PIECE_COUNT - 1 }),
        fc.integer({ min: 0, max: MAX_ORIENTATIONS - 1 }),
        fc.integer({ min: 1, max: 32 }).chain((size) =>
          fc.tuple(fc.constant(size), fc.integer({ min: 0, max: size - 1 }), fc.integer({ min: 0, max: size - 1 })),
        ),
        (piece, orientation, [size, row, col]) => {
          const placement = { piece, orientation, row, col };
          const code = encodeMove(placement, size);
          expect(code).toBeLessThan(2 ** 32);
          expect(decodeMove(code, size)).toEqual(placement);
        },
      ),
    );
  });
});

describe("free corners and forbidden squares (bot helpers)", () => {
  it("Before the first piece the only free corner is the start square", () => {
    const position = newPosition(CLASSIC, [1, 3], 1);
    expect(bitsToSquares(freeCorners(position, 1), 20)).toEqual(["0,0"]);
    expect(bitsToSquares(freeCorners(position, 3), 20)).toEqual(["19,19"]);
    expect(bitsToSquares(freeCorners(position, 2), 20)).toEqual([]);
  });

  it("After a first piece the free corners are its free diagonal squares", () => {
    // Colour 1: an I2 lying at the top-left corner; colour 2's square blocks one diagonal.
    const position = positionWith([
      [1, placement("I2", ["##"], 0, 0)],
      [2, placement("I1", ["#"], 1, 2)],
    ]);
    expect(bitsToSquares(freeCorners(position, 1), 20)).toEqual([]);
    const other = positionWith([[1, placement("I2", ["##"], 0, 0)]]);
    expect(bitsToSquares(freeCorners(other, 1), 20)).toEqual(["1,2"]);
    expect(bitsToSquares(forbiddenSquares(other, 1), 20)).toEqual(["0,0", "0,1", "0,2", "1,0", "1,1"]);
  });
});
