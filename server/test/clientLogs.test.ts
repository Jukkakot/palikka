import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { CLIENT_LOG_LIMITS } from "@palikka/protocol";
import appConfig from "../src/app.config.js";
import { CLIENT_LOG_RATE, mountClientLogs } from "../src/logging/clientLogs.js";
import { configureLogger } from "../src/logging/logger.js";
import { captureLogs } from "./support/captureLogs.js";

const entry = {
  level: "error",
  evt: "client.error",
  ts: "2026-09-26T10:15:02.000Z",
  room: "brave-otters-sing",
  msg: "Cannot read x",
  stack: "TypeError: Cannot read x\n    at Board.tsx:17",
};

describe("observability › Client log shipping", () => {
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

  /** Sends like the browser does: JSON as text/plain (no CORS preflight). */
  function post(body: unknown) {
    return colyseus.http
      .post("/client-logs", {
        headers: { "Content-Type": "text/plain" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
      .then((r: { statusCode: number }) => r.statusCode)
      .catch((e: { statusCode: number }) => e.statusCode);
  }

  it("Client error reaches the server log", async () => {
    expect(await post({ ver: "a1b2c3d", entries: [entry, { ...entry, level: "warn", evt: "client.warn" }] })).toBe(204);

    const lines = logs.lines().filter((l) => l.src === "client");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      level: "error",
      evt: "client.error",
      room: "brave-otters-sing",
      src: "client",
      ver: "a1b2c3d",
      ts: "2026-09-26T10:15:02.000Z",
      stack: entry.stack,
    });
  });

  it("Oversized batch: 400, no entries logged, one http.request line with 400", async () => {
    const entries = Array.from({ length: CLIENT_LOG_LIMITS.maxEntries + 1 }, () => entry);
    expect(await post({ ver: "dev", entries })).toBe(400);

    expect(logs.lines().filter((l) => l.src === "client")).toHaveLength(0);
    expect(logs.byEvt("http.request")).toEqual([expect.objectContaining({ path: "/client-logs", status: 400 })]);
  });

  it("rejects unknown event names and malformed JSON", async () => {
    expect(await post({ ver: "dev", entries: [{ ...entry, evt: "room.created" }] })).toBe(400);
    expect(await post("{not json")).toBe(400);
    expect(logs.lines().filter((l) => l.src === "client")).toHaveLength(0);
  });
});

describe("observability › Client log shipping › Flooding", () => {
  // Own app per test: the shared Colyseus test server would carry limiter state between files.
  async function startApp() {
    const app = express();
    mountClientLogs(app);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    return { url: `http://localhost:${port}/client-logs`, close: () => server.close() };
  }

  afterAll(() => configureLogger());

  it("returns 429 once a sender exceeds the limit, without logging its IP", async () => {
    const logs = captureLogs();
    const { url, close } = await startApp();
    const body = JSON.stringify({ ver: "dev", entries: [entry] });
    const statuses: number[] = [];
    for (let i = 0; i <= CLIENT_LOG_RATE.limit; i++) {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
      statuses.push(res.status);
    }
    close();

    expect(statuses.slice(0, CLIENT_LOG_RATE.limit).every((s) => s === 204)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Privacy in logs: no line contains an IP address.
    expect(logs.raw.some((l) => /\b(\d{1,3}\.){3}\d{1,3}\b|::1|::ffff:/.test(l))).toBe(false);
  });
});
