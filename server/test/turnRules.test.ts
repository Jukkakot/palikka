import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { CLOSE_CODES, type CommandResult } from "@palikka/protocol";
import appConfig from "../src/app.config.js";
import { configureLogger } from "@game-kit/server";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import { captureLogs } from "./support/captureLogs.js";
import { placeFree, startedGame, waitingRoom, type TestClient as Client } from "./support/game.js";

const SHORT_MS = 150;
const LONG_MS = 60_000;

const kick = (client: Client, seat: number) => client.request("kick", { seat }) as Promise<CommandResult>;

describe("turn rules in a room", () => {
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

  const game = (players: number, { turnMs = SHORT_MS, disconnectSeconds = 300 } = {}) =>
    startedGame(colyseus, players, { turnMs, disconnectSeconds });

  /** The current player's whole turn: claim the first empty cell. */
  async function turn(room: GameRoom, client: Client) {
    expect(await placeFree(client, room)).toEqual({ ok: true });
  }

  const expired = (room: GameRoom) => vi.waitFor(() => expect(room.state.turnExpired).toBe(true));

  describe("Turn time limit", () => {
    it("Clock starts with the turn", async () => {
      const { room, clients } = await game(2, { turnMs: LONG_MS });
      const first = room.state.turnDeadline;
      expect(first).toBeGreaterThan(Date.now() + LONG_MS - 5_000);
      expect(room.state.turnExpired).toBe(false);

      await new Promise((r) => setTimeout(r, 5));
      await turn(room, clients[0]!);
      expect(room.state.turnSeat).toBe(2);
      expect(room.state.turnDeadline).toBeGreaterThan(first);
    });

    it("expires after the limit and logs turn.expired", async () => {
      const { room } = await game(2);
      await expired(room);
      expect(logs.byEvt("turn.expired")).toEqual([expect.objectContaining({ seat: 1 })]);
    });

    it("Late but allowed", async () => {
      const { room, clients } = await game(2, { turnMs: 100 });
      await expired(room);
      room.turnLimitMs = LONG_MS;
      await turn(room, clients[0]!);
      expect(room.state.turnSeat).toBe(2);
      expect(room.state.turnExpired).toBe(false);
      expect(room.state.turnDeadline).toBeGreaterThan(Date.now());
    });

    it("Clock starts with the game", async () => {
      const { room } = await game(2, { turnMs: LONG_MS });
      expect(room.state.turnDeadline).toBeGreaterThan(Date.now() + LONG_MS - 5_000);
      expect(room.state.turnSeat).toBe(1);
    });

    it("Alone in the game: the waiting room has no clock", async () => {
      const { room } = await waitingRoom(colyseus, 1, { turnMs: SHORT_MS });
      await new Promise((r) => setTimeout(r, SHORT_MS * 3));
      expect(room.state.turnDeadline).toBe(0);
      expect(room.state.turnExpired).toBe(false);
    });

    it("Second player arrives: no clock and no kick until the start", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2, { turnMs: SHORT_MS });
      await new Promise((r) => setTimeout(r, SHORT_MS * 3));
      expect(room.state.turnDeadline).toBe(0);
      expect(room.state.turnSeat).toBe(0);
      expect(await kick(clients[1]!, 1)).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(room.state.players.size).toBe(2);
    });
  });

  describe("Kicking a slow player", () => {
    it("Kick after the time is up", async () => {
      const { room, clients } = await game(3);
      const closed = new Promise<number>((resolve) => clients[0]!.onLeave(resolve));
      await expired(room);

      expect(await kick(clients[1]!, 1)).toEqual({ ok: true });
      expect(room.state.players.has(clients[0]!.sessionId)).toBe(false);
      expect(room.state.turnSeat).toBe(2);
      expect(room.state.phase).toBe("play");
      expect(room.state.turnExpired).toBe(false);
      expect(await closed).toBe(CLOSE_CODES.KICKED);
      expect(logs.byEvt("player.removed")).toEqual([expect.objectContaining({ seat: 1, reason: "kicked", by: 2 })]);
      expect(logs.byEvt("cmd.accepted").filter((l) => l.cmd !== "start")).toEqual([expect.objectContaining({ cmd: "kick", payload: { seat: 1 } })]);
      // The kicked connection's later hooks change nothing more.
      await vi.waitFor(() => expect(logs.byEvt("player.left")).toHaveLength(1));
      expect(logs.byEvt("player.removed")).toHaveLength(1);
      expect(logs.byEvt("player.dropped")).toHaveLength(0);
    });

    it("Too early", async () => {
      const { room, clients } = await game(2, { turnMs: LONG_MS });
      expect(await kick(clients[1]!, 1)).toEqual({ ok: false, code: "TURN_NOT_EXPIRED" });
      expect(room.state.players.size).toBe(2);
      expect(logs.byEvt("cmd.rejected")[0]).toMatchObject({ cmd: "kick", code: "TURN_NOT_EXPIRED", turnExpired: false });
    });

    it("Turn already passed", async () => {
      const { room, clients } = await game(3);
      await expired(room);
      room.turnLimitMs = LONG_MS;
      await turn(room, clients[0]!);
      expect(await kick(clients[2]!, 1)).toEqual({ ok: false, code: "NOT_KICKABLE" });
      expect(room.state.players.size).toBe(3);
    });

    it("Kicking yourself", async () => {
      const { room, clients } = await game(2);
      await expired(room);
      expect(await kick(clients[0]!, 1)).toEqual({ ok: false, code: "NOT_KICKABLE" });
      expect(room.state.players.size).toBe(2);
    });

    it("rejects a kick in a finished game with WRONG_PHASE", async () => {
      const { room, clients } = await game(2);
      await expired(room);
      room.state.phase = "finished";
      expect(await kick(clients[1]!, 1)).toEqual({ ok: false, code: "WRONG_PHASE" });
    });

    it("Kicking a disconnected player", async () => {
      const { room, clients } = await game(3);
      // A close the SDK does not retry, but the server sees as unintended: the seat is held.
      clients[0]!.connection.close(1000);
      await vi.waitFor(() => expect(room.state.players.get(clients[0]!.sessionId)?.connected).toBe(false));
      await expired(room);

      expect(await kick(clients[1]!, 1)).toEqual({ ok: true });
      expect(room.state.players.has(clients[0]!.sessionId)).toBe(false);
      expect(room.state.turnSeat).toBe(2);
      await vi.waitFor(() => expect(logs.byEvt("player.left")).toHaveLength(1));
      expect(logs.byEvt("player.removed")).toEqual([expect.objectContaining({ seat: 1, reason: "kicked" })]);
    });
  });

  describe("Last player standing wins", () => {
    it("Opponent kicked", async () => {
      const { room, clients } = await game(2, { turnMs: LONG_MS });
      await turn(room, clients[0]!);
      room.turnLimitMs = SHORT_MS;
      await turn(room, clients[1]!);
      // Seat 1 is on turn again; make seat 2 the slow one.
      await turn(room, clients[0]!);
      await expired(room);

      expect(await kick(clients[0]!, 2)).toEqual({ ok: true });
      expect(room.state.phase).toBe("finished");
      expect([...room.state.winners]).toEqual([1]);
      expect(room.state.turnDeadline).toBe(0);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ winners: [1], reason: "lastPlayer" })]);
    });

    it("Two of three leave", async () => {
      const { room, clients } = await game(3, { turnMs: LONG_MS });
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      expect(room.state.phase).toBe("play");
      expect([...room.state.winners]).toEqual([]);

      await clients[2]!.leave();
      await vi.waitFor(() => expect(room.state.phase).toBe("finished"));
      expect([...room.state.winners]).toEqual([1]);
    });

    it("Opponent leaves before anyone played", async () => {
      const { room, clients } = await game(2, { turnMs: LONG_MS });
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.phase).toBe("finished"));
      expect([...room.state.winners]).toEqual([1]);
      expect(room.state.turnDeadline).toBe(0);
    });
  });

  describe("Only the current player acts", () => {
    it("Before the start: a placement in the waiting room is WRONG_PHASE", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      const before = JSON.stringify(room.state.toJSON());
      expect(await clients[0]!.request("move", { move: { piece: 0, orientation: 0, row: 0, col: 0 } })).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(await clients[1]!.request("move", { move: { piece: 0, orientation: 0, row: 0, col: 6 } })).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(JSON.stringify(room.state.toJSON())).toBe(before);
    });
  });

  describe("Leaving the game", () => {
    it("Player leaves mid-game", async () => {
      const { room, clients } = await game(3, { turnMs: LONG_MS });
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.has(clients[1]!.sessionId)).toBe(false));
      expect(room.state.turnSeat).toBe(1);
      expect(logs.byEvt("player.removed")).toEqual([expect.objectContaining({ seat: 2, reason: "left" })]);
    });
  });

  describe("Dropped connection", () => {
    it("Shown as disconnected", async () => {
      const { room, clients } = await game(2, { turnMs: LONG_MS });
      clients[1]!.connection.close(1000);
      await vi.waitFor(() => expect(room.state.players.get(clients[1]!.sessionId)?.connected).toBe(false));
      expect(room.state.players.get(clients[1]!.sessionId)?.seat).toBe(2);
      expect(logs.byEvt("player.dropped")[0]).toMatchObject({ holdSeconds: 300 });
    });

    it("Removed after five minutes (shortened here)", async () => {
      const { room, clients } = await game(3, { turnMs: LONG_MS, disconnectSeconds: 0.2 });
      clients[1]!.connection.close(1000);
      await vi.waitFor(() => expect(room.state.players.has(clients[1]!.sessionId)).toBe(false));
      expect(logs.byEvt("player.removed")).toEqual([expect.objectContaining({ seat: 2, reason: "timeout" })]);
      expect(room.state.phase).toBe("play");
    });
  });
});
