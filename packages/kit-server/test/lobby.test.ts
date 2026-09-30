import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import { CLOSE_CODES } from "@game-kit/protocol";
import appConfig from "./support/app.js";
import { configureLogger } from "../src/index.js";
import { MAX_OPEN_GAMES } from "../src/index.js";
import { ConnectFourRoom as GameRoom } from "./support/app.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, join, NAMES, startedGame, waitingRoom, type TestClient } from "./support/game.js";

/** What a client decodes about the game. */
interface DecodedState {
  hostSeat: number;
  phase: string;
  players: { get(id: string): { name: string; seat: number } | undefined; size: number };
}

const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];
const closedWith = (client: TestClient) => new Promise<number>((resolve) => client.onLeave(resolve));

describe("lobby in a room", () => {
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

  describe("Nickname", () => {
    it("Valid nickname: the trimmed name is synced and logged", async () => {
      const room = (await colyseus.createRoom("game", { nickname: "Maija" })) as unknown as GameRoom;
      const client = await join(colyseus, room, "  Maija  ");
      expect(room.state.players.get(client.sessionId)?.name).toBe("Maija");
      await vi.waitFor(() => expect((client.state as DecodedState).players.get(client.sessionId)?.name).toBe("Maija"));
      expect(logs.byEvt("player.joined")[0]).toMatchObject({ name: "Maija" });
    });

    it("Server refuses an invalid nickname: no seat is taken", async () => {
      const { room } = await waitingRoom(colyseus, 1);
      await expect(join(colyseus, room, "   ")).rejects.toThrow("INVALID_NICKNAME");
      await expect(colyseus.connectTo(room as never, {})).rejects.toThrow("INVALID_NICKNAME");
      expect(room.state.players.size).toBe(1);
      expect(logs.byEvt("room.refused")).toEqual([
        expect.objectContaining({ reason: "nickname" }),
        expect.objectContaining({ reason: "nickname" }),
      ]);
    });

    it("creating a game with an invalid nickname creates no room", async () => {
      await expect(colyseus.sdk.create("game", { nickname: "M" })).rejects.toThrow("INVALID_NICKNAME");
      expect(logs.byEvt("room.created")).toHaveLength(0);
    });

    it("Same nickname twice: both are seated", async () => {
      const room = (await colyseus.createRoom("game", { nickname: "Maija" })) as unknown as GameRoom;
      await join(colyseus, room, "Maija");
      await join(colyseus, room, "Maija");
      expect([...room.state.players.values()].map((p) => [p.seat, p.name])).toEqual([
        [1, "Maija"],
        [2, "Maija"],
      ]);
    });
  });

  describe("Waiting room", () => {
    it("No current player before the start; the first joiner hosts", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      expect(room.state.phase).toBe("waiting");
      expect(room.state.turnSeat).toBe(0);
      expect(room.state.turnDeadline).toBe(0);
      expect(room.state.hostSeat).toBe(1);
      await vi.waitFor(() => expect((clients[1]!.state as DecodedState).hostSeat).toBe(1));
      expect(logs.byEvt("turn.changed")).toHaveLength(0);
    });
  });

  describe("Starting the game", () => {
    it("Host starts: the host on turn with a running clock, the room closed to joining", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
      // turns › First player starts: the host (seat 1) has the first turn.
      expect(room.state.turnSeat).toBe(1);
      expect(room.state.phase).toBe("play");
      expect(room.state.turnDeadline).toBeGreaterThan(Date.now());
      expect(room.locked).toBe(true);
      expect(logs.byEvt("game.started")).toEqual([
        expect.objectContaining({ seats: [1, 2, 3], startSeat: room.state.turnSeat, dealSeed: expect.any(Number) }),
      ]);
      expect(logs.byEvt("game.dealt")).toHaveLength(0);
      expect(logs.byEvt("cmd.accepted")).toEqual([expect.objectContaining({ cmd: "start" })]);
    });

    it("Guest tries to start: NOT_HOST and the waiting room is unchanged", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      const before = JSON.stringify(room.state.toJSON());
      expect(await clients[1]!.request("start", {})).toEqual({ ok: false, code: "NOT_HOST" });
      expect(JSON.stringify(room.state.toJSON())).toBe(before);
      expect(logs.byEvt("cmd.rejected")[0]).toMatchObject({ cmd: "start", code: "NOT_HOST", hostSeat: 1, seated: 2 });
    });

    it("Host alone tries to start: NOT_ENOUGH_PLAYERS", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: false, code: "NOT_ENOUGH_PLAYERS" });
      expect(room.state.phase).toBe("waiting");
    });

    it("Start twice: WRONG_PHASE and nothing changes", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      const before = JSON.stringify(room.state.toJSON());
      expect(await clients[0]!.request("start", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(JSON.stringify(room.state.toJSON())).toBe(before);
    });

    it("a start with fields is INVALID_COMMAND", async () => {
      const { clients } = await waitingRoom(colyseus, 2);
      expect(await clients[0]!.request("start", { seat: 1 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    });

    it("First player starts: every seat can be drawn to begin", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      forceStartSeat(room, 3);
      await clients[0]!.request("start", {});
      expect(room.state.turnSeat).toBe(3);
    });

    it("No joining after the start: joinById is refused", async () => {
      const { room } = await startedGame(colyseus, 2);
      await expect(colyseus.sdk.joinById(room.roomId, { nickname: "Myöhäinen" })).rejects.toThrow();
      expect(room.state.players.size).toBe(2);
    });
  });

  describe("Leaving the waiting room", () => {
    it("Guest leaves: the seat is free and the host stays", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      expect(room.state.hostSeat).toBe(1);
      expect(room.state.phase).toBe("waiting");
      expect(logs.byEvt("room.closed")).toHaveLength(0);
      expect(room.locked).toBe(false);
    });

    it("Host leaves: the game closes and the guests are told why", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      const closed = [closedWith(clients[1]!), closedWith(clients[2]!)];
      await clients[0]!.leave();
      expect(await Promise.all(closed)).toEqual([CLOSE_CODES.HOST_LEFT, CLOSE_CODES.HOST_LEFT]);
      await vi.waitFor(() => expect(room.state.players.size).toBe(0));
      expect(logs.byEvt("room.closed")).toEqual([expect.objectContaining({ reason: "hostLeft" })]);
      // The closed guests hold no seats.
      expect(logs.byEvt("player.dropped")).toHaveLength(0);
    });

    it("a dropped host's hold running out closes the game, and ends a dropped guest's hold", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3, { disconnectSeconds: 60 });
      clients[2]!.connection.close(1000);
      await vi.waitFor(() => expect(room.state.players.get(clients[2]!.sessionId)?.connected).toBe(false));
      room.disconnectLimitSeconds = 0.2;
      const closed = closedWith(clients[1]!);
      clients[0]!.connection.close(1000);

      expect(await closed).toBe(CLOSE_CODES.HOST_LEFT);
      await vi.waitFor(() => expect(room.state.players.size).toBe(0));
      expect(logs.byEvt("player.removed")).toEqual(
        expect.arrayContaining([expect.objectContaining({ seat: 1, reason: "timeout" }), expect.objectContaining({ seat: 3 })]),
      );
      expect(logs.byEvt("room.closed")).toEqual([expect.objectContaining({ reason: "hostLeft" })]);
    });
  });

  describe("Open games list", () => {
    it("the listing shows the host's nickname while open, and open: false and locked after the start", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      await vi.waitFor(async () => expect((await listing(room.roomId))?.metadata).toEqual({ host: NAMES[0], open: true, pool: "", seated: 2, watchable: false, options: {} }));
      forceStartSeat(room, 1);
      await clients[0]!.request("start", {});
      await vi.waitFor(async () => {
        const entry = await listing(room.roomId);
        expect(entry?.metadata).toMatchObject({ open: false });
        expect(entry?.locked).toBe(true);
      });
    });

    it("the pool is part of the metadata", async () => {
      const room = await colyseus.createRoom("game", { nickname: "Maija", pool: "e2e-1" });
      expect((await listing(room.roomId))?.metadata).toMatchObject({ pool: "e2e-1" });
    });
  });

  describe("Invite link", () => {
    it("No private game to create: the private option is refused", async () => {
      await expect(colyseus.sdk.create("game", { nickname: "Maija", private: true })).rejects.toThrow("INVALID_OPTIONS");
      expect(logs.byEvt("room.created")).toHaveLength(0);
    });

    it("Quick play finds every open game; joinById joins one", async () => {
      const { room } = await waitingRoom(colyseus, 1);
      expect((await listing(room.roomId))?.private).toBe(false);
      const quick = await colyseus.sdk.joinOrCreate("game", { nickname: "Pekka" });
      expect(quick.roomId).toBe(room.roomId);

      const invited = await colyseus.sdk.joinById(room.roomId, { nickname: "Liisa" });
      expect(invited.roomId).toBe(room.roomId);
      expect(room.state.players.get(invited.sessionId)?.seat).toBe(3);
    });
  });

  describe("Game limit", () => {
    afterEach(() => {
      GameRoom.maxOpenGames = MAX_OPEN_GAMES;
    });

    it("Server full: creating is refused, joining an existing game works, and a disposed game frees a slot", async () => {
      GameRoom.maxOpenGames = GameRoom.openGames + 1;
      const first = await colyseus.sdk.create("game", { nickname: "Maija" });
      await expect(colyseus.sdk.create("game", { nickname: "Pekka" })).rejects.toThrow("SERVER_FULL");
      expect(logs.byEvt("room.refused")).toEqual([expect.objectContaining({ reason: "cap" })]);

      const joined = await colyseus.sdk.joinOrCreate("game", { nickname: "Liisa" });
      expect(joined.roomId).toBe(first.roomId);

      await joined.leave();
      await first.leave();
      await vi.waitFor(() => expect(logs.byEvt("room.disposed").map((l) => l.room)).toContain(first.roomId));
      const again = await colyseus.sdk.create("game", { nickname: "Pekka" });
      expect(again.roomId).not.toBe(first.roomId);
    });
  });
});
