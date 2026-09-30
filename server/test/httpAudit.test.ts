import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { configureLogger } from "@game-kit/server";
import { captureLogs } from "./support/captureLogs.js";

describe("observability › HTTP request audit", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  let logs: ReturnType<typeof captureLogs>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });
  beforeEach(() => {
    logs = captureLogs();
  });

  it("Normal request: one info line with method, path, status and duration", async () => {
    await colyseus.http.get("/does-not-exist").catch(() => {});
    await vi.waitFor(() => expect(logs.byEvt("http.request")).toHaveLength(1));
    expect(logs.byEvt("http.request")[0]).toMatchObject({
      level: "info",
      method: "GET",
      path: "/does-not-exist",
      status: 404,
      durMs: expect.any(Number),
    });
  });

  it("Health check: logged at debug", async () => {
    await colyseus.http.get("/health");
    await vi.waitFor(() => expect(logs.byEvt("http.request")).toHaveLength(1));
    expect(logs.byEvt("http.request")[0]).toMatchObject({ level: "debug", path: "/health", status: 200 });
  });

  it("Matchmaking: joining via the SDK produces an http.request line", async () => {
    await colyseus.sdk.joinOrCreate("game", { nickname: "Maija" });
    await vi.waitFor(() =>
      expect(logs.byEvt("http.request").some((l) => String(l.path).startsWith("/matchmake"))).toBe(true),
    );
  });
});
