import { placement, positionWith } from "@palikka/rules/testing";
import { describe, expect, it } from "vitest";
import { seatView } from "../test/views.ts";
import { resultRows, toGameView, type SyncedColour, type SyncedGame, type SyncedPlayer, type SyncedState } from "./viewModel.ts";

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

/** A running game's synced state: `seats` people or bots, colours with their seats, `turn` = [seat, colour]. */
function synced(variant: string, colours: SyncedColour[], turn: [number, number], game: Partial<SyncedGame> = {}): SyncedState {
  const size = variant === "duo" ? 14 : 20;
  const seats = [...new Set(colours.map((c) => c.seat ?? c.colour).filter((seat) => seat !== 0))];
  const players = new Map<string, SyncedPlayer>(seats.map((seat) => [`s${seat}`, { seat, name: `P${seat}`, connected: true }]));
  return { game: { variant, cells: new Array<number>(size * size).fill(0), colours, turnColour: turn[1], ...game }, players, turnSeat: turn[0], phase: "play" };
}
const playing = (c: number, seat: number, extra: Partial<SyncedColour> = {}): SyncedColour => ({ colour: c, seat, pieces: [], out: false, left: false, ...extra });

describe("variants › view model", () => {
  const double = [playing(1, 1), playing(2, 2), playing(3, 1), playing(4, 2)];
  const trio = [playing(1, 1), playing(2, 2), playing(3, 3), playing(4, 0)];

  it("classic: seats are colours, the tray is the viewer's colour", () => {
    const view = toGameView(synced("classic", [playing(1, 1), playing(2, 2)], [2, 2]), "r", "s1")!;
    expect(view).toMatchObject({ variant: "classic", boardSize: 20, maxSeats: 4, turnColour: 2, turnShared: false, myColours: [1], trayColour: 1 });
    expect(view.seats.map((s) => s.colours)).toEqual([[1], [2]]);
    // Older state without a turn colour: the turn seat is the colour.
    const old = toGameView(synced("classic", [colour(1), colour(2)], [2, 2], { turnColour: undefined, variant: undefined }), "r", "s1")!;
    expect(old.turnColour).toBe(2);
  });

  it("Duo: the 14×14 board", () => {
    const view = toGameView(synced("duo", [playing(1, 1), playing(2, 2)], [1, 1]), "r", "s1")!;
    expect(view.boardSize).toBe(14);
    expect(view.position!.config.size).toBe(14);
    expect(toGameView(synced("duo", [playing(1, 1)], [1, 1], { cells: new Array<number>(400).fill(0) }), "r", "s1")).toBeUndefined();
  });

  it("Tuplaväri: seat 1 plays colours 1 and 3, their scores summed; colour 3 on turn fills the tray", () => {
    const view = toGameView(synced("double", double, [1, 3]), "r", "s1")!;
    expect(view.seats.map((s) => [s.seat, s.colours, s.score])).toEqual([
      [1, [1, 3], -178],
      [2, [2, 4], -178],
    ]);
    expect(view).toMatchObject({ isMyTurn: true, turnColour: 3, myColours: [1, 3], trayColour: 3 });
    expect(view.position!.sides).toEqual({ 1: 1, 2: 2, 3: 1, 4: 2 });
  });

  it("Tuplaväri: while the other plays, the tray shows the viewer's next colour (skipping one that is out)", () => {
    expect(toGameView(synced("double", double, [2, 2]), "r", "s1")!.trayColour).toBe(3);
    expect(toGameView(synced("double", double, [2, 4]), "r", "s1")!.trayColour).toBe(1);
    const outThree = [playing(1, 1), playing(2, 2), playing(3, 1, { out: true }), playing(4, 2)];
    expect(toGameView(synced("double", outThree, [2, 2]), "r", "s1")!.trayColour).toBe(1);
  });

  it("Kolmikko: the shared colour on the viewer's turn is theirs to play", () => {
    const mine = toGameView(synced("trio", trio, [1, 4]), "r", "s1")!;
    expect(mine).toMatchObject({ isMyTurn: true, turnShared: true, myColours: [1, 4], trayColour: 4 });
    const other = toGameView(synced("trio", trio, [2, 4]), "r", "s1")!;
    expect(other).toMatchObject({ isMyTurn: false, turnShared: true, myColours: [1], trayColour: 1 });
    expect(other.seats.map((s) => s.colours)).toEqual([[1], [2], [3]]);
  });

  it("Tuplaväri result: one row per player with both colours and the summed score", () => {
    const position = positionWith(
      [
        [1, placement("I5", ["#####"], 0, 0)],
        [3, placement("I1", ["#"], 19, 19)],
        [2, placement("I2", ["##"], 0, 18)],
      ],
      [1, 2, 3, 4],
    );
    const seats = [seatView(1, "Maija", { colours: [1, 3] }), seatView(2, "Kettu", { colours: [2, 4], isBot: true, isMe: false })];
    const rows = resultRows(position, { colours: double }, seats, [1]);
    expect(rows.map((r) => [r.seat, r.colours, r.score, r.squares, r.piecesLeft, r.rank, r.winner])).toEqual([
      [1, [1, 3], -84 - 88, 6, 40, 1, true],
      [2, [2, 4], -87 - 89, 2, 41, 2, false],
    ]);
  });

  it("Kolmikko result: the shared colour last, not counted, without a rank", () => {
    const position = positionWith([[4, placement("I5", ["#####"], 19, 0)]], [1, 2, 3, 4]);
    const seats = [seatView(1, "Maija"), seatView(2, "Pekka", { isMe: false }), seatView(3, "Liisa", { isMe: false })];
    const rows = resultRows(position, { colours: trio }, seats, [1, 2, 3]);
    expect(rows.map((r) => [r.seat, r.colours, r.rank, r.shared, r.winner])).toEqual([
      [1, [1], 1, false, true],
      [2, [2], 1, false, true],
      [3, [3], 1, false, true],
      [0, [4], 0, true, false],
    ]);
    expect(rows[3]!.score).toBe(-84);
  });
});
