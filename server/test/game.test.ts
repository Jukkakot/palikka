import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { setupBoard } from "@labyrinth/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameState } from "../src/rooms/schema/GameState.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, NAMES, startedGame, waitingRoom } from "./support/game.js";

type ClientState = {
  squares: { id: number; rotation: number }[];
  spare: { id: number; rotation: number };
  players: Map<string, { seat: number; connected: boolean }>;
};

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

  const seedOf = (roomId: string) => logs.byEvt("game.setup").find((l) => l.room === roomId)!.seed as number;

  describe("Seeded game setup", () => {
    it("Identical board for everyone: synced squares and spare equal setupBoard(logged seed)", async () => {
      const { room, clients } = await waitingRoom(colyseus, 2);
      const [a, b] = clients as [(typeof clients)[number], (typeof clients)[number]];
      const sa = a.state as unknown as ClientState;
      const sb = b.state as unknown as ClientState;
      await vi.waitFor(() => expect(sb.squares?.length).toBe(49));

      const expected = setupBoard(seedOf(room.roomId));
      const plain = (s: ClientState) => ({
        squares: [...s.squares].map((t) => ({ id: t.id, rotation: t.rotation })),
        spare: { id: s.spare.id, rotation: s.spare.rotation },
      });
      const want = {
        squares: expected.squares.map((t) => ({ id: t.id, rotation: t.rotation })),
        spare: { id: expected.spare.id, rotation: expected.spare.rotation },
      };
      expect(plain(sa)).toEqual(want);
      expect(plain(sb)).toEqual(want);
    });

    it("New games differ: each room draws its own seed", async () => {
      const r1 = await colyseus.createRoom<GameState>("game", { nickname: NAMES[0] });
      const r2 = await colyseus.createRoom<GameState>("game", { nickname: NAMES[1] });
      expect(seedOf(r1.roomId)).not.toBe(seedOf(r2.roomId));
    });

    it("Seed is private: no seed in the state a client receives", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      const client = clients[0]!;
      await vi.waitFor(() => expect((client.state as unknown as ClientState).squares?.length).toBe(49));
      const json = JSON.stringify((client.state as unknown as { toJSON(): unknown }).toJSON());
      expect(json).not.toContain("seed");
      expect(json).not.toContain(String(seedOf(room.roomId)));
    });
  });

  describe("Seats and start corners", () => {
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

    it("Seats kept at the start: seats 1 and 3 stand on the top-left and bottom-right corners", async () => {
      const { room, clients, player } = await waitingRoom(colyseus, 3);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      forceStartSeat(room, 1);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
      expect([player(0).seat, player(0).row, player(0).col]).toEqual([1, 0, 0]);
      expect([player(2).seat, player(2).row, player(2).col]).toEqual([3, 6, 6]);
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
