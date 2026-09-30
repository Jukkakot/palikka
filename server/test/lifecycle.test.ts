import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { configureLogger, ROOM_ID_PATTERN, uniqueRoomId } from "@game-kit/server";
import { captureLogs } from "./support/captureLogs.js";
import { NAMES, waitingRoom, type TestClient } from "./support/game.js";

describe("observability › Room lifecycle events", () => {
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

  it("logs join and leave with room and player ids", async () => {
    const { room, clients } = await waitingRoom(colyseus, 2);
    const [host, guest] = clients as [TestClient, TestClient];

    await guest.leave();
    await vi.waitFor(() => expect(logs.byEvt("player.left")).toHaveLength(1));

    expect(logs.byEvt("player.joined").map((l) => [l.player, l.name])).toEqual([
      [host.sessionId, NAMES[0]],
      [guest.sessionId, NAMES[1]],
    ]);
    expect(logs.byEvt("player.left")[0]).toMatchObject({ room: room.roomId, player: guest.sessionId });
  });

  it("Dropped player returns: player.dropped then player.reconnected", async () => {
    const { room, clients } = await waitingRoom(colyseus, 2);
    const client = clients[0]!;

    // The SDK only auto-reconnects rooms up for 5 s by default; allow it at once.
    client.reconnection.minUptime = 0;
    // Close without consent, as a network loss would; the SDK reconnects on its own.
    client.connection.close(4010);

    await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
    expect(logs.byEvt("player.dropped")[0]).toMatchObject({ room: room.roomId, player: client.sessionId });
    expect(logs.byEvt("player.left")).toHaveLength(0);
  });
});

describe("observability › Readable game identifier", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });

  it("Room creation: readable id that equals `room` in room.created", async () => {
    const logs = captureLogs();
    const room = await colyseus.createRoom("game", { nickname: NAMES[0] });

    expect(room.roomId).toMatch(ROOM_ID_PATTERN);
    expect(room.roomId.length).toBeLessThanOrEqual(32);
    expect(logs.byEvt("room.created")[0]).toMatchObject({ room: room.roomId });
  });

  it("Collision: a taken id is replaced by a different one", async () => {
    const ids = ["brave-otters-sing", "calm-foxes-jump"];
    const id = await uniqueRoomId(
      async (candidate) => candidate === "brave-otters-sing",
      () => ids.shift()!,
    );
    expect(id).toBe("calm-foxes-jump");
  });
});
