// @vitest-environment jsdom
import { bestLine, DAILY_SEAT, startDailyPuzzle, targetOf } from "@labyrinth/rules";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalRoom } from "../session/localRoom.ts";
import { toGameView } from "../session/viewModel.ts";
import { moveHint, shiftHint } from "./hint.ts";

const quiet = { setTimeout: () => 0, clearTimeout: () => {} };
const viewOf = (room: LocalRoom) => toGameView(room.state, room.roomId, "me")!;

beforeEach(() => localStorage.clear());

describe("daily-puzzle › Puzzle hint follows a best route", () => {
  it("Hint at the start: the first step of a best route", () => {
    const room = LocalRoom.createDaily("Maija", "2026-09-27", quiet);
    const { game, par } = startDailyPuzzle("2026-09-27", "Maija");
    const line = bestLine(game.board, game.seats[0]!.pawn, targetOf(game.seats[0]!)!, undefined, par)!;
    expect(shiftHint(viewOf(room))).toEqual(line[0]);
  });

  for (const date of ["2026-09-27", "2026-09-28"]) {
    it(`Following the hint solves at par (${date})`, async () => {
      const room = LocalRoom.createDaily("Maija", date, quiet);
      const par = room.state.par!;
      for (let guard = 0; guard < 5 && room.game.step !== "finished"; guard++) {
        const turn = shiftHint(viewOf(room))!;
        await room.request("shift", { insertion: turn.insertion, rotation: turn.rotation });
        const to = moveHint(viewOf(room), turn)!;
        await room.request("move", to);
      }
      expect(room.game.step).toBe("finished");
      expect(room.game.winnerSeat).toBe(DAILY_SEAT);
      expect(room.game.turn).toBe(par);
    });
  }

  it("Hint on the move step: after an unhinted shift, a square is still hinted", async () => {
    const room = LocalRoom.createDaily("Maija", "2026-09-27", quiet);
    await room.request("shift", { insertion: "N1", rotation: 0 });
    const view = viewOf(room);
    const to = moveHint(view);
    expect(view.reachable).toContainEqual(to);
  });
});
