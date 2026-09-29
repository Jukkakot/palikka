// @vitest-environment jsdom
import { DAILY_SEAT, startDailyPuzzle, targetOf, tileAt, treasureOf, type GameState } from "@labyrinth/rules";
import { beforeEach, describe, expect, it } from "vitest";
import { dailyRecordOf, loadDailyRecord, saveDailyRecord, todayString } from "./dailyRecord.ts";
import { isDailyRoomId, loadLocalGame, saveLocalGame } from "./localGameStore.ts";
import { LocalRoom } from "./localRoom.ts";
import { createConnector } from "./useGameSession.ts";

const DATE = "2026-09-27";
const quiet = { setTimeout: () => 0, clearTimeout: () => {} };

beforeEach(() => localStorage.clear());

/** Shift N1 (never moves the corner) and stay: one plain turn. */
async function plainTurn(room: LocalRoom) {
  await room.request("shift", { insertion: "N1", rotation: 0 });
  await room.request("move", room.game.seats[0]!.pawn);
}

/**
 * Saves an attempt in its move step with the pawn already standing on the destination's tile, as if
 * the shift had carried it there: staying solves the puzzle in `turn`.
 */
function onTheTreasure(roomId: string, turn: number) {
  const { game, par } = startDailyPuzzle(DATE, "Maija");
  const target = targetOf(game.seats[0]!)!;
  const at = game.board.squares.findIndex((t) => treasureOf(t.id) === target);
  const square = { row: Math.floor(at / 7), col: at % 7 };
  expect(treasureOf(tileAt(game.board, square).id)).toBe(target);
  const moveStep: GameState = { ...game, step: "move", turn, seats: game.seats.map((s) => ({ ...s, pawn: square })) };
  saveLocalGame({ roomId, game: moveStep, par, history: [] });
  return LocalRoom.restore(roomId, quiet)!;
}

describe("daily-puzzle › Same puzzle for everyone on a day (on the device)", () => {
  it("a new attempt is the date's puzzle in the puzzle slot, with its par recorded", () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    expect(isDailyRoomId(room.roomId)).toBe(true);
    const puzzle = startDailyPuzzle(DATE, "Maija");
    expect(room.game).toEqual(puzzle.game);
    expect(room.state.par).toBe(puzzle.par);
    expect(loadDailyRecord(DATE)).toEqual({ date: DATE, roomId: room.roomId, par: puzzle.par });
    expect(loadDailyRecord("2026-09-28")).toBeUndefined();
  });

  it("todayString is the local date; old-format records are ignored", () => {
    expect(todayString(new Date(2026, 8, 7, 23, 59))).toBe("2026-09-07");
    localStorage.setItem("labyrinth.daily", JSON.stringify({ date: DATE, roomId: "local-daily-old", result: { turns: 9 } }));
    expect(loadDailyRecord(DATE)).toBeUndefined();
  });
});

describe("daily-puzzle › Undo and try again", () => {
  it("Undo a move: back before the last shift, the turn count too; nothing left to undo at the start", async () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    expect(room.state.undoable).toBe(false);
    expect((await room.request("undo", {})).ok).toBe(false);
    const start = room.game;
    await plainTurn(room);
    await room.request("shift", { insertion: "N3", rotation: 0 });
    expect(room.game.turn).toBe(2);
    expect(room.state.undoable).toBe(true);

    await room.request("undo", {}); // this turn's shift
    expect(room.game.step).toBe("shift");
    expect(room.game.turn).toBe(2);
    await room.request("undo", {}); // the whole previous turn
    expect(room.game).toEqual(start);
    expect(room.state.undoable).toBe(false);
  });

  it("undo survives a reload", async () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    await room.request("shift", { insertion: "N1", rotation: 0 });
    const again = LocalRoom.restore(room.roomId, quiet)!;
    expect((await again.request("undo", {})).ok).toBe(true);
    expect(again.game.step).toBe("shift");
  });

  it("Leaving midway: the attempt stays saved and the connector continues it", async () => {
    const room = LocalRoom.createDaily("Maija", DATE, quiet);
    await room.request("shift", { insertion: "N1", rotation: 0 });
    await room.leave();
    const again = (await createConnector().playDaily({ nickname: "Maija", date: DATE })) as LocalRoom;
    expect(again.roomId).toBe(room.roomId);
    expect(again.game.step).toBe("move");
  });

  it("Try again keeps the best: 4, then 3, then 5 turns → the day's best is 3; a solved attempt is followed by a new one", async () => {
    const par = startDailyPuzzle(DATE, "Maija").par;
    for (const [i, turns] of [4, 3, 5].entries()) {
      const roomId = `local-daily-try${i}`;
      saveDailyRecord({ ...loadDailyRecord(DATE), date: DATE, roomId, par });
      const room = onTheTreasure(roomId, turns);
      await room.request("move", room.game.seats[0]!.pawn);
      expect(room.game.step).toBe("finished");
    }
    expect(dailyRecordOf("local-daily-try2")?.best).toEqual({ turns: 3 });
    const next = (await createConnector().playDaily({ nickname: "Maija", date: DATE })) as LocalRoom;
    expect(next.roomId).not.toBe("local-daily-try2");
    expect(next.game.step).toBe("shift");
    expect(loadDailyRecord(DATE)?.best?.turns).toBe(3);
  });

  it("no rematch in a puzzle", async () => {
    saveDailyRecord({ date: DATE, roomId: "local-daily-x", par: 2 });
    const room = onTheTreasure("local-daily-x", 2);
    await room.request("move", room.game.seats[0]!.pawn);
    expect((await room.request("rematch", {})).ok).toBe(false);
  });

  it("Quick game in between: the quick game and the puzzle are saved side by side", () => {
    const puzzle = LocalRoom.createDaily("Maija", DATE, quiet);
    const quick = LocalRoom.create("Maija", 1, { ...quiet, seed: () => 7 });
    expect(loadLocalGame(puzzle.roomId)?.game.seats).toHaveLength(1);
    expect(loadLocalGame(quick.roomId)?.game.seats).toHaveLength(2);
  });
});

describe("daily-puzzle › Goal and score (on the device)", () => {
  it("Solved: the puzzle ends in the turn the pawn reaches the treasure", async () => {
    saveDailyRecord({ date: DATE, roomId: "local-daily-x", par: 2 });
    const last = onTheTreasure("local-daily-x", 3);
    await last.request("move", last.game.seats[0]!.pawn);
    expect(last.game.step).toBe("finished");
    expect(last.game.winnerSeat).toBe(DAILY_SEAT);
    expect(loadDailyRecord(DATE)?.best).toEqual({ turns: 3 });
    await last.leave();
    expect(loadLocalGame(last.roomId)).toBeUndefined();
  });
});
