import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CLASSIC } from "./config.js";
import { hasLegalMove, legalMoves } from "./movegen.js";
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
