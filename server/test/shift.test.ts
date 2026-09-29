import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { INSERTION_IDS, type CommandResult, type MovePayload, type ShiftPayload } from "@labyrinth/protocol";
import { createBoard, INSERTIONS, shiftBoard, tileSpec, type Rotation } from "@labyrinth/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameState } from "../src/rooms/schema/GameState.js";
import { captureLogs } from "./support/captureLogs.js";
import { startedGame, type TestClient as Client } from "./support/game.js";

const boardOf = (state: GameState) => {
  const tile = (t: { id: number; rotation: number }) => ({ id: t.id, kind: tileSpec(t.id).kind, rotation: t.rotation as Rotation });
  return createBoard({ squares: [...state.squares].map(tile), spare: tile(state.spare) });
};

const shift = (client: Client, payload: ShiftPayload) => client.request("shift", payload) as Promise<CommandResult>;
const move = (client: Client, payload: MovePayload) => client.request("move", payload) as Promise<CommandResult>;

describe("protocol › insertion ids", () => {
  it("equal the rules' INSERTIONS", () => {
    expect([...INSERTION_IDS]).toEqual([...INSERTIONS]);
  });
});

describe("turns and tile-shift in a room", () => {
  /** A whole turn: shift, then stay on the (possibly carried) pawn square. */
  async function turn(room: { state: GameState }, client: Client, payload: ShiftPayload) {
    expect(await shift(client, payload)).toEqual({ ok: true });
    const me = room.state.players.get(client.sessionId)!;
    expect(await move(client, { row: me.row, col: me.col })).toEqual({ ok: true });
  }

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

  const game = (players: number) => startedGame(colyseus, players);

  describe("Current player", () => {
    it("the start seat takes the first turn with a shift", async () => {
      const { room } = await startedGame(colyseus, 3, { startSeat: 2 });
      expect(room.state.turnSeat).toBe(2);
      expect(room.state.phase).toBe("shift");
      expect(logs.byEvt("turn.changed")[0]).toMatchObject({ room: room.roomId, from: 0, to: 2 });
    });

    it("Current player leaves", async () => {
      const { room, clients } = await game(3);
      await turn(room, clients[0]!, { insertion: "N1", rotation: 0 });
      expect(room.state.turnSeat).toBe(2);

      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(3));
    });

    it("a player who is not in turn leaving keeps the turn where it is", async () => {
      const { room, clients } = await game(3);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      expect(room.state.turnSeat).toBe(1);
    });
  });

  describe("Turn passes after the move", () => {
    it("Shift does not end the turn", async () => {
      const { room, clients } = await game(2);
      expect(await shift(clients[0]!, { insertion: "N1", rotation: 0 })).toEqual({ ok: true });
      expect(room.state.turnSeat).toBe(1);
      expect(room.state.phase).toBe("move");
      expect(logs.byEvt("phase.changed")[0]).toMatchObject({ from: "shift", to: "move", turnSeat: 1 });
    });

    it("Two players alternate (seats 1 and 3)", async () => {
      const { room, clients } = await game(3);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));

      await turn(room, clients[0]!, { insertion: "N1", rotation: 0 });
      expect(room.state.turnSeat).toBe(3);
      expect(room.state.phase).toBe("shift");
      await turn(room, clients[2]!, { insertion: "W3", rotation: 0 });
      expect(room.state.turnSeat).toBe(1);
    });

    it("Dropped player keeps their place", async () => {
      const { room, clients } = await game(2);
      // Seat 2's connection dropped; the seat is still held during the reconnect window.
      room.state.players.get(clients[1]!.sessionId)!.connected = false;

      await turn(room, clients[0]!, { insertion: "N1", rotation: 0 });
      expect(room.state.turnSeat).toBe(2);
    });

    it("Current player leaves while moving", async () => {
      const { room, clients } = await game(3);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      await clients[0]!.leave();
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(room.state.phase).toBe("shift");
    });
  });

  describe("Accepted shift", () => {
    it("updates squares, spare and lastInsertion exactly as shiftBoard says", async () => {
      const { room, clients } = await game(2);
      const before = boardOf(room.state);

      expect(await shift(clients[0]!, { insertion: "E3", rotation: 180 })).toEqual({ ok: true });
      expect(boardOf(room.state)).toEqual(shiftBoard(before, "E3", 180).board);
      expect(room.state.lastInsertion).toBe("E3");
      expect(logs.byEvt("cmd.accepted").at(-1)).toMatchObject({ cmd: "shift", payload: { insertion: "E3", rotation: 180 } });
    });

    it("syncs the shifted board to the other player", async () => {
      const { room, clients } = await game(2);
      await shift(clients[0]!, { insertion: "S5", rotation: 90 });
      const other = clients[1]!.state as unknown as GameState;
      await vi.waitFor(() => expect(other.lastInsertion).toBe("S5"));
      expect(boardOf(other)).toEqual(boardOf(room.state));
    });
  });

  describe("Rejected shift", () => {
    it("Out of turn: NOT_YOUR_TURN, state unchanged, facts in the audit line", async () => {
      const { room, clients } = await game(2);
      const before = boardOf(room.state);

      expect(await shift(clients[1]!, { insertion: "N1", rotation: 0 })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
      expect(boardOf(room.state)).toEqual(before);
      expect(room.state.turnSeat).toBe(1);
      expect(logs.byEvt("cmd.rejected")[0]).toMatchObject({
        cmd: "shift",
        code: "NOT_YOUR_TURN",
        phase: "shift",
        turnSeat: 1,
        lastInsertion: "",
        seat: 2,
      });
    });

    it("Reverse forbidden: S1 right after N1", async () => {
      const { room, clients } = await game(2);
      await turn(room, clients[0]!, { insertion: "N1", rotation: 0 });
      const before = boardOf(room.state);

      expect(await shift(clients[1]!, { insertion: "S1", rotation: 0 })).toEqual({ ok: false, code: "REVERSE_PUSH_FORBIDDEN" });
      expect(boardOf(room.state)).toEqual(before);
      expect(room.state.lastInsertion).toBe("N1");
      expect(logs.byEvt("cmd.rejected")[0]).toMatchObject({ code: "REVERSE_PUSH_FORBIDDEN", lastInsertion: "N1" });
    });

    it("Other shifts allowed after N1: N1, N3, W1", async () => {
      const { room, clients } = await game(2);
      await turn(room, clients[0]!, { insertion: "N1", rotation: 0 });
      await turn(room, clients[1]!, { insertion: "N1", rotation: 0 });
      await turn(room, clients[0]!, { insertion: "N3", rotation: 0 });
      await turn(room, clients[1]!, { insertion: "W1", rotation: 0 });
    });

    it("a fixed line is not an insertion point", async () => {
      const { room, clients } = await game(2);
      expect(await shift(clients[0]!, { insertion: "N2" as never, rotation: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
      expect(room.state.lastInsertion).toBe("");
    });
  });
});
