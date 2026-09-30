import { afterEach, describe, expect, it, vi } from "vitest";
import { axiomOptionsOf, configureLogger, log, serverVersion } from "@game-kit/server";
import { captureLogs } from "./support/captureLogs.js";

afterEach(() => configureLogger());

describe("observability › Structured log lines", () => {
  it("Server event: one JSON line, level and evt first, context ids present", () => {
    const logs = captureLogs();
    log.info("player.joined", { room: "brave-otters-sing", player: "p1", extra: 1 });

    expect(logs.raw).toHaveLength(1);
    const line = logs.lines()[0]!;
    expect(Object.keys(line).slice(0, 4)).toEqual(["level", "evt", "room", "player"]);
    expect(line).toMatchObject({
      level: "info",
      evt: "player.joined",
      room: "brave-otters-sing",
      player: "p1",
      src: "server",
      ver: "dev",
    });
  });

  it("Error with stack trace: stays on one line", () => {
    const logs = captureLogs();
    log.error("cmd.failed", { err: new Error("boom") });

    expect(logs.raw).toHaveLength(1);
    const err = logs.lines()[0]!.err as { message: string; stack: string };
    expect(err.message).toBe("boom");
    expect(err.stack.split("\n").length).toBeGreaterThan(1);
  });

  it("production lines have no timestamp; development lines end with time", () => {
    const prod = captureLogs({ NODE_ENV: "production" });
    log.info("server.started");
    expect(prod.lines()[0]).not.toHaveProperty("time");

    const dev = captureLogs({ NODE_ENV: "development", LOG_LEVEL: "info" });
    log.info("server.started");
    expect(Object.keys(dev.lines()[0]!).at(-1)).toBe("time");
  });

  it("uses the short Render commit as version", () => {
    expect(serverVersion({ RENDER_GIT_COMMIT: "0123456789abcdef" })).toBe("0123456");
    expect(serverVersion({})).toBe("dev");
  });
});

describe("observability › Central log store", () => {
  /** In-memory stream that parses the lines it receives. */
  const memory = () => {
    const raw: string[] = [];
    return { stream: { write: (chunk: string) => void raw.push(...chunk.split("\n").filter(Boolean)) }, lines: () => raw.map((l) => JSON.parse(l)) };
  };
  const shipping = { NODE_ENV: "production", AXIOM_TOKEN: "xaat-test", AXIOM_DATASET: "palikka" };

  it("production with a token and dataset: every line, server and client, goes to stdout and Axiom, with time", () => {
    const stdout = memory();
    const axiom = memory();
    const axiomStream = vi.fn(() => axiom.stream);
    configureLogger({ env: shipping, destination: stdout.stream, axiomStream });
    log.info("server.started", { port: 1 });
    log.client({ level: "warn", evt: "client.warn", ts: "2026-09-27T10:00:00.000Z" }, "abc1234");

    expect(axiomStream).toHaveBeenCalledExactlyOnceWith({ dataset: "palikka", token: "xaat-test" });
    expect(axiom.lines()).toEqual(stdout.lines());
    expect(axiom.lines().map((l) => l.evt)).toEqual(["server.started", "client.warn"]);
    expect(Date.parse(axiom.lines()[0].time)).not.toBeNaN();
  });

  it("Not configured, or not production: nothing is shipped", () => {
    expect(axiomOptionsOf({ NODE_ENV: "production" })).toBeUndefined();
    expect(axiomOptionsOf({ NODE_ENV: "production", AXIOM_TOKEN: "t" })).toBeUndefined();
    expect(axiomOptionsOf({ ...shipping, NODE_ENV: "development" })).toBeUndefined();
    expect(axiomOptionsOf({ ...shipping, NODE_ENV: "test" })).toBeUndefined();
    expect(axiomOptionsOf(shipping)).toEqual({ dataset: "palikka", token: "xaat-test" });
    expect(axiomOptionsOf({ ...shipping, AXIOM_EDGE: "eu-central-1.aws.edge.axiom.co" })).toMatchObject({ edge: "eu-central-1.aws.edge.axiom.co" });
  });
});

describe("observability › Structured log lines (client entries)", () => {
  it("writes client entries with src=client, the client version and timestamp", () => {
    const logs = captureLogs();
    log.client(
      { level: "error", evt: "client.error", ts: "2026-09-26T10:15:02.000Z", room: "r", msg: "x", stack: "a\nb" },
      "a1b2c3d",
    );
    expect(logs.lines()[0]).toMatchObject({
      level: "error",
      evt: "client.error",
      room: "r",
      src: "client",
      ver: "a1b2c3d",
      ts: "2026-09-26T10:15:02.000Z",
      msg: "x",
    });
  });
});
