import { describe, expect, it } from "vitest";
import { botRng, simpleBotMove } from "./bot.js";
import { palikkaRules as rules } from "./contract.js";
import { endGame, playMove, removeSeat, seatOnTurn, startGame, type Game } from "./game.js";
import { placementText } from "./moves.js";

const seats = [1, 2, 3].map((seat) => ({ seat, name: `P${seat}`, bot: seat !== 1 }));

describe("palikkaRules", () => {
  it("takes the seat range from the variant", () => {
    expect(rules.seatRange({ variant: "classic" })).toEqual({ min: 2, max: 4 });
    expect(rules.seatRange({ variant: "duo" })).toEqual({ min: 2, max: 2 });
    expect(rules.seatRange({ variant: "trio" })).toEqual({ min: 3, max: 3 });
  });

  it.each(["classic", "trio"] as const)("plays the same seeded %s game as the match layer, move by move", (variant) => {
    let viaContract = rules.start(4242, seats, { variant });
    let viaMatch: Game = startGame(4242, seats, variant);
    expect(viaContract).toEqual(viaMatch);
    for (let i = 0; i < 400 && !rules.isOver(viaContract); i++) {
      const seat = rules.seatOnTurn(viaContract);
      const move = rules.fallbackMove(viaContract)!;
      const { position, seed } = viaMatch;
      expect(move).toEqual(simpleBotMove(position, position.turn, botRng(seed, position, position.turn)));
      const a = rules.play(viaContract, seat, move);
      const b = playMove(viaMatch, seatOnTurn(viaMatch), move);
      expect(a).toEqual(b);
      if (!a.ok || !b.ok) throw new Error("refused");
      [viaContract, viaMatch] = [a.game, b.game];
      if (i === 30) {
        // A seat leaves halfway: the same removal either way.
        [viaContract, viaMatch] = [rules.removeSeat(viaContract, 2), removeSeat(viaMatch, 2)];
        expect(viaContract).toEqual(viaMatch);
      }
    }
    expect(rules.isOver(viaContract)).toBe(true);
    expect(rules.winners(viaContract)).toEqual(viaMatch.winners);
    expect(rules.finishFacts(viaContract)).toEqual({ scores: expect.stringMatching(/^1:-?\d+\/\d+/) });
  });

  it("refuses like the match layer, with the audit facts the room logs", () => {
    const game = rules.start(1, seats, { variant: "classic" });
    const offStart = { piece: 0, orientation: 0, row: 5, col: 5 };
    expect(rules.play(game, 1, offStart)).toEqual({ ok: false, code: "NOT_ON_START", facts: { seat: 1, move: placementText(offStart) } });
    expect(rules.play(game, 2, offStart)).toEqual({ ok: false, code: "NOT_YOUR_TURN", facts: { seat: 2 } });
    expect(rules.play(game, 4, offStart)).toEqual({ ok: false, code: "NOT_SEATED", facts: { seat: 4 } });
    expect(rules.play(endGame(game), 1, offStart)).toEqual({ ok: false, code: "WRONG_PHASE", facts: { expected: "play" } });
  });

  it("gives the turn facts and ends like the match layer", () => {
    const game = rules.start(1, seats, { variant: "classic" });
    expect(rules.turnFacts(game)).toEqual({ colour: 1 });
    expect(rules.end(game)).toEqual(endGame(game));
    expect(rules.moveText({ piece: 0, orientation: 0, row: 5, col: 5 })).toBe("I1/0@5,5");
  });
});
