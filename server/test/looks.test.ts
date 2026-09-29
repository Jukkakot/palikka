import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { CommandResult } from "@labyrinth/protocol";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import { captureLogs } from "./support/captureLogs.js";
import { join, waitingRoom, type TestClient } from "./support/game.js";

const setLook = (client: TestClient, look: number) => client.request("setLook", { look }) as Promise<CommandResult>;

describe("pawn-looks in a room", () => {
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

  describe("Pawns given out in an online game", () => {
    it("No preference: every seat keeps its own pawn", async () => {
      const { player } = await waitingRoom(colyseus, 2);
      expect([player(0).look, player(1).look]).toEqual([1, 2]);
    });

    it("Preferred pawn free, then taken: the preferred one, else the seat's own", async () => {
      const { room } = await waitingRoom(colyseus, 1);
      const maija = await join(colyseus, room, "Maija", { look: 3 });
      const pekka = await join(colyseus, room, "Pekka", { look: 3 });
      expect(room.state.players.get(maija.sessionId)).toMatchObject({ seat: 2, look: 3 });
      // Seat 3's own pawn is taken too, so the lowest free one.
      expect(room.state.players.get(pekka.sessionId)).toMatchObject({ seat: 3, look: 2 });
    });

    it("a bot gets its seat's pawn when free, else the lowest free one", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      expect(await setLook(clients[0]!, 2)).toEqual({ ok: true });
      await clients[0]!.request("addBot", { seat: 2 });
      await clients[0]!.request("addBot", { seat: 3 });
      expect(room.state.players.get("bot:2")!.look).toBe(1);
      expect(room.state.players.get("bot:3")!.look).toBe(3);
    });
  });

  describe("Changing the pawn in the waiting room", () => {
    it("Change to a free pawn: accepted, synced and logged; the same pawn again changes nothing", async () => {
      const { clients, player } = await waitingRoom(colyseus, 2);
      expect(await setLook(clients[0]!, 4)).toEqual({ ok: true });
      expect(player(0).look).toBe(4);
      expect(logs.byEvt("player.look")).toEqual([expect.objectContaining({ seat: 1, from: 1, to: 4 })]);
      expect(await setLook(clients[0]!, 4)).toEqual({ ok: true });
      expect(logs.byEvt("player.look")).toHaveLength(1);
    });

    it("Taken pawn: LOOK_TAKEN and nothing changes", async () => {
      const { clients, player } = await waitingRoom(colyseus, 2);
      expect(await setLook(clients[0]!, 2)).toEqual({ ok: false, code: "LOOK_TAKEN" });
      expect(player(0).look).toBe(1);
    });

    it("After the start: WRONG_PHASE", async () => {
      const { clients, player } = await waitingRoom(colyseus, 2);
      await clients[0]!.request("start", {});
      expect(await setLook(clients[1]!, 4)).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(player(1).look).toBe(2);
    });

    it("an invalid pawn is rejected as an invalid command", async () => {
      const { clients } = await waitingRoom(colyseus, 1);
      expect(await setLook(clients[0]!, 5)).toEqual({ ok: false, code: "INVALID_COMMAND" });
    });
  });
});
