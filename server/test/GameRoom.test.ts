import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { waitingRoom } from "./support/game.js";

describe("GameRoom", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("adds a connected player on join and removes them on leave", async () => {
    // The guest leaves: the host keeps the room open.
    const { room, clients } = await waitingRoom(colyseus, 2);
    const client = clients[1]!;

    expect(room.state.players.get(client.sessionId)?.connected).toBe(true);

    await client.leave();
    await vi.waitFor(() => expect(room.state.players.has(client.sessionId)).toBe(false));
  });

  it("mounts the kit's watch route", async () => {
    const res = await colyseus.http.post("/watch", { body: "{}", headers: { "Content-Type": "text/plain" } }).catch((err: { statusCode?: number }) => err);
    expect((res as { statusCode?: number }).statusCode).toBe(400);
  });

  it("serves a health check reporting the rules version and build", async () => {
    const res = await colyseus.http.get("/health");
    // Tests run from source, without a build: no build time.
    expect(res.data).toEqual({ status: "ok", rulesVersion: expect.any(String), version: "dev", builtAt: null });
  });
});
