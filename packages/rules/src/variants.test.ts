import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CLASSIC } from "./config.js";
import { placement } from "./engineFixtures.js";
import { controllerOf, isFinished, playMove, removeSeat, seatOnTurn, startGame, type Game, type GameSeat } from "./game.js";
import { legalMoves } from "./movegen.js";
import { decodeMove } from "./moves.js";
import { PIECE_SIZES } from "./pieces.js";
import { checkPlacement, newPosition, type Position } from "./position.js";
import { referenceMoves } from "./reference.js";
import { createRng } from "./rng.js";
import { sideScores, winners } from "./scoring.js";
import { DUO, VARIANT_IDS, VARIANTS, variantOf, type VariantId } from "./variants.js";

const seat = (n: number, bot = false): GameSeat => ({ seat: n, name: `P${n}`, bot });
const seats = (...ns: number[]) => ns.map((n) => seat(n));
const sorted = (moves: readonly number[]) => [...moves].sort((a, b) => a - b);

/** One random legal move by whoever plays the turn. */
function step(game: Game, rng: ReturnType<typeof createRng>): Game {
  const moves = legalMoves(game.position, game.position.turn);
  const move = decodeMove(moves[rng.int(0, moves.length - 1)]!, game.position.config.size);
  const result = playMove(game, seatOnTurn(game), move);
  if (!result.ok) throw new Error(result.code);
  return result.game;
}

describe("variants › Variants", () => {
  it("defines each variant's board, start squares, player counts and colour groups", () => {
    expect(VARIANT_IDS).toEqual(["classic", "duo", "double", "trio"]);
    expect(VARIANTS.classic).toMatchObject({ board: CLASSIC, minPlayers: 2, maxPlayers: 4 });
    expect(VARIANTS.classic.colourGroups([1, 2, 4])).toEqual([[1], [2], [4]]);
    expect(VARIANTS.duo).toMatchObject({ board: DUO, minPlayers: 2, maxPlayers: 2 });
    expect(DUO.size).toBe(14);
    expect(DUO.starts).toEqual({ 1: { row: 4, col: 4 }, 2: { row: 9, col: 9 } });
    expect(VARIANTS.duo.colourGroups([1, 3])).toEqual([[1], [2]]);
    expect(VARIANTS.double).toMatchObject({ board: CLASSIC, minPlayers: 2, maxPlayers: 2 });
    expect(VARIANTS.double.colourGroups([1, 2])).toEqual([[1, 3], [2, 4]]);
    expect(VARIANTS.trio).toMatchObject({ board: CLASSIC, minPlayers: 3, maxPlayers: 3, shared: 4 });
    expect(VARIANTS.trio.colourGroups([1, 2, 3])).toEqual([[1], [2], [3]]);
    expect(variantOf(undefined).id).toBe("classic");
    expect(variantOf("nope").id).toBe("classic");
  });

  it("Default: Perus on the 20×20 board, every player plays their seat's colour", () => {
    const game = startGame(1, seats(1, 2, 4));
    expect(game.variant).toBe("classic");
    expect(game.position.config).toBe(CLASSIC);
    expect(game.control).toEqual({ 1: 1, 2: 2, 4: 4 });
    expect(game.position.sides).toEqual({ 1: 1, 2: 2, 4: 4 });
  });

  it("Tuplaväri colours: seat 1 plays 1 and 3, seat 2 plays 2 and 4, colour 1 on turn", () => {
    const game = startGame(1, seats(2, 1), "double");
    expect(game.position.colours).toEqual([1, 2, 3, 4]);
    expect(game.control).toEqual({ 1: 1, 2: 2, 3: 1, 4: 2 });
    expect(game.position.turn).toBe(1);
    expect(seatOnTurn(game)).toBe(1);
  });

  it("Seats with a gap: Duo in seats 1 and 3 gives colours 1 and 2", () => {
    const game = startGame(1, seats(1, 3), "duo");
    expect(game.position.colours).toEqual([1, 2]);
    expect(game.control).toEqual({ 1: 1, 2: 3 });
    expect(controllerOf(game, 2)).toBe(3);
  });

  it("Wrong number of players: the start is refused", () => {
    expect(() => startGame(1, seats(1, 2), "trio")).toThrow(RangeError);
    expect(() => startGame(1, seats(1, 2, 3), "duo")).toThrow(RangeError);
    expect(() => startGame(1, seats(1), "classic")).toThrow(RangeError);
  });

  it("Kolmikko: colours 1–3 by seat, colour 4 shared", () => {
    const game = startGame(1, seats(1, 2, 4), "trio");
    expect(game.control).toEqual({ 1: 1, 2: 2, 3: 4, 4: 0 });
    expect(game.position.sides[4]).toBe(0);
  });
});

describe("variants › Duo board", () => {
  const duo = startGame(1, seats(1, 2), "duo").position;

  it("Duo first move: legal only when it covers row 5, column 5", () => {
    expect(checkPlacement(duo, 1, placement("I1", ["#"], 4, 4))).toBeUndefined();
    expect(checkPlacement(duo, 1, placement("I1", ["#"], 0, 0))).toBe("NOT_ON_START");
    expect(checkPlacement(duo, 2, placement("I1", ["#"], 9, 9))).toBeUndefined();
  });

  it("Board edge: a placement reaching column 15 is off the board", () => {
    expect(checkPlacement(duo, 1, placement("I5", ["#####"], 4, 10))).toBe("OFF_BOARD");
    expect(checkPlacement(duo, 1, placement("I5", ["#####"], 4, 0))).toBeUndefined();
  });
});

describe("variants › The shared colour", () => {
  /** Plays randomly and records which seat played each of colour 4's pieces. */
  function sharedPlayers(game: Game, seed: number, count: number, before?: (g: Game) => Game): number[] {
    const rng = createRng(seed);
    const players: number[] = [];
    let current = before ? before(game) : game;
    while (!isFinished(current) && players.length < count) {
      if (current.position.turn === 4) players.push(seatOnTurn(current));
      current = step(current, rng);
    }
    return players;
  }

  it("Rotation: seats 1, 2, 3, then 1 again", () => {
    expect(sharedPlayers(startGame(3, seats(1, 2, 3), "trio"), 3, 5)).toEqual([1, 2, 3, 1, 2]);
  });

  it("A player left: after three pieces, seat 3 plays the fourth (seats 1 and 3 remain)", () => {
    const game = startGame(3, seats(1, 2, 3), "trio");
    const placed = { ...game.position.placed, 4: [0, 1, 2] };
    const after = removeSeat({ ...game, position: { ...game.position, placed } }, 2);
    expect(controllerOf(after, 4)).toBe(3);
  });

  it("Only the seat that plays the shared colour may move it", () => {
    const rng = createRng(9);
    let game = startGame(9, seats(1, 2, 3), "trio");
    while (game.position.turn !== 4) game = step(game, rng);
    const move = decodeMove(legalMoves(game.position, 4)[0]!, 20);
    expect(playMove(game, 2, move)).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    const played = playMove(game, 1, move);
    expect(played.ok && played.game.position.placed[4]).toHaveLength(1);
  });
});

describe("variants › Score and winners per player", () => {
  /** Every piece except one of each given size. */
  const missing = (...sizes: number[]) => {
    const left = [...sizes];
    return PIECE_SIZES.map((_, piece) => piece).filter((piece) => {
      const i = left.indexOf(PIECE_SIZES[piece]!);
      if (i < 0) return true;
      left.splice(i, 1);
      return false;
    });
  };
  const ended = (sides: Record<number, number>, placed: Record<number, number[]>): Position => ({
    ...newPosition(CLASSIC, [1, 2, 3, 4], 1, sides),
    placed,
    turn: 0,
    ended: true,
  });

  it("Tuplaväri score: −14 against −13, the second player wins", () => {
    const position = ended({ 1: 1, 3: 1, 2: 2, 4: 2 }, { 1: missing(4), 3: missing(5, 5), 2: missing(1, 5), 4: missing(2, 5) });
    expect(sideScores(position).map((s) => [s.side, s.colours, s.score])).toEqual([
      [1, [1, 3], -14],
      [2, [2, 4], -13],
    ]);
    expect(winners(position)).toEqual([2]);
  });

  it("Shared colour does not count: the best of colours 1–3 wins", () => {
    const position = ended({ 1: 1, 2: 2, 3: 3, 4: 0 }, { 1: missing(5, 5), 2: missing(5), 3: missing(5, 5, 5), 4: missing(1) });
    expect(sideScores(position).map((s) => s.side)).toEqual([1, 2, 3]);
    expect(winners(position)).toEqual([2]);
  });

  it("One colour per player: exactly the classic result", () => {
    const position = ended({}, { 1: missing(4), 2: missing(5), 3: missing(4), 4: missing(5, 5) });
    expect(winners(position)).toEqual([1, 3]);
  });
});

describe("variants › Leaving a multi-colour game", () => {
  it("Tuplaväri leaver: colours 2 and 4 are out, the game ends and the first player wins", () => {
    const game = removeSeat(startGame(1, seats(1, 2), "double"), 2);
    expect(isFinished(game)).toBe(true);
    expect(game.position.out).toEqual(expect.arrayContaining([2, 4]));
    expect(game.winners).toEqual([1]);
  });

  it("Kolmikko leaver: colour 3 is out, colour 4 goes on between seats 1 and 2", () => {
    const rng = createRng(5);
    let game = removeSeat(startGame(5, seats(1, 2, 3), "trio"), 3);
    expect(game.position.out).toEqual([3]);
    expect(isFinished(game)).toBe(false);
    const players: number[] = [];
    while (!isFinished(game) && players.length < 4) {
      if (game.position.turn === 4) players.push(seatOnTurn(game));
      game = step(game, rng);
    }
    expect(players).toEqual([1, 2, 1, 2]);
  });
});

describe("variants › Random games", () => {
  const seatsFor: Record<VariantId, number[][]> = {
    classic: [[1, 2], [1, 3, 4], [1, 2, 3, 4]],
    duo: [[1, 2], [2, 4]],
    double: [[1, 2], [3, 4]],
    trio: [[1, 2, 3], [1, 2, 4]],
  };

  it("stay legal against the reference and end with winners among the staying seats", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 32 - 1 }),
        fc.constantFrom(...VARIANT_IDS),
        fc.nat(),
        fc.option(fc.integer({ min: 1, max: 40 })),
        (seed, variant, pick, leaveAt) => {
          const options = seatsFor[variant];
          const seated = options[pick % options.length]!;
          const rng = createRng(seed);
          let game = startGame(seed, seats(...seated), variant);
          const colourCount = game.position.colours.length;
          let moves = 0;
          while (!isFinished(game)) {
            const { position } = game;
            if (moves % 7 === 0) {
              expect(sorted(legalMoves(position, position.turn))).toEqual(sorted(referenceMoves(position, position.turn)));
            }
            const turnSeat = seatOnTurn(game);
            expect(game.seats.some((s) => s.seat === turnSeat)).toBe(true);
            if (leaveAt !== null && moves === leaveAt) game = removeSeat(game, turnSeat);
            else game = step(game, rng);
            moves++;
          }
          expect(game.position.colours).toHaveLength(colourCount);
          expect(game.position.sides).toEqual(Object.fromEntries(Object.entries(game.control)));
          expect(game.winners.length).toBeGreaterThan(0);
          for (const w of game.winners) {
            expect(game.left).not.toContain(w);
            expect(seated).toContain(w);
          }
        },
      ),
      { numRuns: 12 },
    );
  });
});
