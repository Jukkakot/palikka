import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { BOARD_CELLS_PER_SIDE, MAX_PIECE_ORIENTATIONS, PIECES_PER_COLOUR } from "@palikka/protocol";
import { CLASSIC, MAX_ORIENTATIONS, PIECE_COUNT, type Game, type Position } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import type { GameState } from "../src/rooms/schema/GameState.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, NAMES, startedGame, waitingRoom } from "./support/game.js";

type ClientState = {
  cells: number[];
  colours: { colour: number; pieces: number[]; out: boolean; left: boolean }[];
  players: Map<string, { seat: number; connected: boolean }>;
  turnSeat: number;
};
const seen = (client: { state: unknown }) => client.state as ClientState;

/** Puts `position` into the room's running game, to set up a board without playing to it. */
function setPosition(room: GameRoom, position: Position): void {
  const holder = room as unknown as { game: Game };
  holder.game = { ...holder.game, position };
}

describe("game-session", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  let logs: ReturnType<typeof captureLogs>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    logs = captureLogs();
  });

  describe("Board and moves", () => {
    it("protocol and rules agree on the board size and the piece set", () => {
      expect(BOARD_CELLS_PER_SIDE).toBe(CLASSIC.size);
      expect(PIECES_PER_COLOUR).toBe(PIECE_COUNT);
      expect(MAX_PIECE_ORIENTATIONS).toBe(MAX_ORIENTATIONS);
    });

    it("Everyone gets the same empty 20×20 board in the waiting room", async () => {
      const { clients } = await waitingRoom(colyseus, 2);
      for (const client of clients) {
        await vi.waitFor(() => expect(seen(client).cells?.length).toBe(400));
        expect([...seen(client).cells].every((c) => c === 0)).toBe(true);
      }
    });

    it("Legal first move: accepted, seen by every client, and the next colour is on turn", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      expect(await clients[0]!.request("place", placement("I1", ["#"], 0, 0))).toEqual({ ok: true });
      expect(room.state.turnSeat).toBe(2);
      await vi.waitFor(() => expect(seen(clients[1]!).cells[0]).toBe(1));
      expect([...seen(clients[1]!).colours[0]!.pieces]).toEqual([0]);
      expect(seen(clients[1]!).turnSeat).toBe(2);
    });

    it("Illegal move: NOT_ON_START, the board is unchanged and the move is in the audit line", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      expect(await clients[0]!.request("place", placement("I1", ["#"], 5, 5))).toEqual({ ok: false, code: "NOT_ON_START" });
      expect([...room.state.cells].every((c) => c === 0)).toBe(true);
      expect(room.state.turnSeat).toBe(1);
      expect(logs.byEvt("cmd.rejected")).toEqual([expect.objectContaining({ cmd: "place", code: "NOT_ON_START", move: "I1/0@5,5" })]);
    });

    it("Not your turn, and a malformed move", async () => {
      const { clients } = await startedGame(colyseus, 2);
      expect(await clients[1]!.request("place", placement("I1", ["#"], 0, 19))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
      expect(await clients[0]!.request("place", { row: 0, col: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    });

    it("The lowest seat starts by rule", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
      expect(room.state.turnSeat).toBe(1);
      expect([...room.state.colours].map((c) => c.colour)).toEqual([1, 2]);
    });

    it("Stuck colour skipped: shown as out, and the next colour is on turn", async () => {
      const { room, clients } = await startedGame(colyseus, 3);
      // Colour 1 already sits on colour 2's start corner, so colour 2 can never move.
      setPosition(room, positionWith([[1, placement("I1", ["#"], 0, 19)]], [1, 2, 3]));
      expect(await clients[0]!.request("place", placement("I2", ["##"], 1, 17))).toEqual({ ok: true });
      expect(room.state.colours[1]!.out).toBe(true);
      expect(room.state.turnSeat).toBe(3);
      await vi.waitFor(() => expect(seen(clients[2]!).colours[1]?.out).toBe(true));
    });

    it("End and result: no colour can move, the winners are synced and logged", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      // Everything but the top-left corner is taken: after colour 1's single square nobody can move.
      const cells = new Array<number>(400).fill(2);
      cells[0] = 0;
      setPosition(room, { ...positionWith([], [1, 2]), cells });
      expect(await clients[0]!.request("place", placement("I1", ["#"], 0, 0))).toEqual({ ok: true });
      expect(room.state.phase).toBe("finished");
      expect([...room.state.winners]).toEqual([1]);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ winners: [1], reason: "complete", scores: "1:-88/1 2:-89/0" })]);
    });
  });

  describe("Seats", () => {
    const seats = (room: { state: GameState }) =>
      Object.fromEntries([...room.state.players.entries()].map(([id, p]) => [id, p.seat]));

    it("Seats in join order", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      const [c1, c2, c3] = clients.map((c) => c);
      expect(room.state.phase).toBe("waiting");
      expect(seats(room)).toEqual({ [c1!.sessionId]: 1, [c2!.sessionId]: 2, [c3!.sessionId]: 3 });
    });

    it("Freed seat is reused", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      const c2 = clients[1]!;
      await c2.leave();
      await vi.waitFor(() => expect(room.state.players.has(c2.sessionId)).toBe(false));

      const c4 = await colyseus.connectTo(room as never, { nickname: "Olli" });
      expect(room.state.players.get(c4.sessionId)?.seat).toBe(2);
    });

    it("Full game: a fifth quick-play player gets a new game", async () => {
      const first = await colyseus.sdk.joinOrCreate("game", { nickname: NAMES[0] });
      for (let i = 1; i < 4; i++) await colyseus.sdk.joinOrCreate("game", { nickname: NAMES[i] });
      const fifth = await colyseus.sdk.joinOrCreate("game", { nickname: "Viides" });
      expect(fifth.roomId).not.toBe(first.roomId);
    });

    it("Seats kept at the start: seats 1 and 3 keep their seats (and colours)", async () => {
      const { room, clients, player } = await waitingRoom(colyseus, 3);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      forceStartSeat(room, 1);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
      expect(player(0).seat).toBe(1);
      expect(player(2).seat).toBe(3);
    });

    it("Only game is running: quick play places the player in a new game", async () => {
      const { room } = await startedGame(colyseus, 2);
      const late = await colyseus.sdk.joinOrCreate("game", { nickname: "Myöhäinen" });
      expect(late.roomId).not.toBe(room.roomId);
    });

    it("quick-play pools are separate: same pool meets, different pools do not", async () => {
      const a1 = await colyseus.sdk.joinOrCreate("game", { nickname: "Aa", pool: "a" });
      const a2 = await colyseus.sdk.joinOrCreate("game", { nickname: "Ab", pool: "a" });
      const b1 = await colyseus.sdk.joinOrCreate("game", { nickname: "Ba", pool: "b" });
      expect(a2.roomId).toBe(a1.roomId);
      expect(b1.roomId).not.toBe(a1.roomId);
    });
  });
});
