import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { seatView } from "../test/views.ts";
import { resultRows, type SyncedColour } from "./viewModel.ts";

const colour = (c: number, left = false): SyncedColour => ({ colour: c, pieces: [], out: true, left });

describe("result-screen › Result table", () => {
  it("Ranked rows: the better score first, with squares and pieces left", () => {
    // Colour 2 has a five-square piece on the board, colour 1 a single square.
    const position = positionWith(
      [
        [1, placement("I1", ["#"], 0, 0)],
        [2, placement("I5", ["#####"], 0, 15)],
      ],
      [1, 2],
    );
    const rows = resultRows(position, { colours: [colour(1), colour(2)] }, [seatView(1, "Maija"), seatView(2, "Kettu", { isBot: true, isMe: false })], [2]);
    expect(rows.map((r) => [r.seat, r.rank, r.winner, r.squares, r.piecesLeft])).toEqual([
      [2, 1, true, 5, 20],
      [1, 2, false, 1, 20],
    ]);
    expect(rows[0]).toMatchObject({ name: "Kettu", isBot: true, score: -84 });
    expect(rows[1]).toMatchObject({ name: "Maija", isMe: true, score: -88 });
  });

  it("Shared rank: equal scores both rank 1, the next is 3", () => {
    const position = positionWith(
      [
        [1, placement("I2", ["##"], 0, 0)],
        [3, placement("I2", ["##"], 19, 18)],
      ],
      [1, 2, 3],
    );
    const seats = [seatView(1, "Maija"), seatView(2, "Pekka", { isMe: false }), seatView(3, "Liisa", { isMe: false })];
    const rows = resultRows(position, { colours: [colour(1), colour(2), colour(3)] }, seats, [1, 3]);
    expect(rows.map((r) => [r.seat, r.rank, r.winner])).toEqual([
      [1, 1, true],
      [3, 1, true],
      [2, 3, false],
    ]);
  });

  it("Leaver: marked as left, without a name, not a winner", () => {
    const position = positionWith([[4, placement("I5", ["#####"], 19, 0)]], [1, 4]);
    const rows = resultRows(position, { colours: [colour(1), colour(4, true)] }, [seatView(1, "Maija")], [1]);
    const leaver = rows.find((r) => r.seat === 4)!;
    expect(leaver).toMatchObject({ left: true, winner: false, name: "", rank: 1 });
    expect(rows.find((r) => r.seat === 1)!.left).toBe(false);
  });
});
