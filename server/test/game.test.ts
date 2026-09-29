import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { BOARD_CELLS_PER_SIDE } from "@palikka/protocol";
import { BOARD_SIZE, CELL_COUNT } from "@palikka/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameState } from "../src/rooms/schema/GameState.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, NAMES, startedGame, waitingRoom } from "./support/game.js";

type ClientState = {
  cells: number[];
  players: Map<string, { seat: number; connected: boolean }>;
};

describe("game-session", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    captureLogs();
  });

  describe("Board", () => {
    it("protocol and rules agree on the board size", () => {
      expect(BOARD_CELLS_PER_SIDE).toBe(BOARD_SIZE);
    });

    it("Everyone gets the same empty 20×20 board in the waiting room", async () => {
      const { clients } = await waitingRoom(colyseus, 2);
      for (const client of clients) {
        await vi.waitFor(() => expect((client.state as unknown as ClientState).cells?.length).toBe(CELL_COUNT));
        expect([...(client.state as unknown as ClientState).cells].every((c) => c === 0)).toBe(true);
      }
    });

    it("A placement is synced to every client", async () => {
      const { clients } = await startedGame(colyseus, 2);
      expect(await clients[0]!.request("place", { row: 2, col: 3 })).toEqual({ ok: true });
      await vi.waitFor(() => expect((clients[1]!.state as unknown as ClientState).cells[2 * 20 + 3]).toBe(1));
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
