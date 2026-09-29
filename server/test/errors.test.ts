import { EventEmitter } from "node:events";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { frameworkLogger } from "../src/logging/frameworkLogger.js";
import { configureLogger } from "../src/logging/logger.js";
import { installProcessHandlers } from "../src/logging/processHandlers.js";
import { LoggedRoom } from "../src/rooms/LoggedRoom.js";
import { captureLogs } from "./support/captureLogs.js";

class ThrowingTimerRoom extends LoggedRoom {
  async onCreate() {
    await super.onCreate();
    this.clock.setTimeout(() => {
      throw new Error("timer exploded");
    }, 10);
  }
}

describe("observability › Uncaught server errors", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
    colyseus.server.define("throwing_timer", ThrowingTimerRoom);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });

  it("Error in a room timer: one error line with room id and stack; server keeps serving", async () => {
    const logs = captureLogs();
    const room = await colyseus.createRoom("throwing_timer", {});
    await colyseus.connectTo(room);

    await vi.waitFor(() => expect(logs.byEvt("room.error")).toHaveLength(1));
    const line = logs.byEvt("room.error")[0]!;
    expect(line).toMatchObject({ level: "error", room: room.roomId });
    expect((line.err as { stack: string }).stack).toContain("timer exploded");

    const health = await colyseus.http.get("/health");
    expect(health.statusCode).toBe(200);
  });

  it("process handlers log uncaught exceptions (then exit) and unhandled rejections", () => {
    const logs = captureLogs();
    const proc = Object.assign(new EventEmitter(), { exit: vi.fn() });
    installProcessHandlers(proc as unknown as NodeJS.Process);

    proc.emit("unhandledRejection", new Error("rejected"));
    proc.emit("uncaughtException", new Error("uncaught"));

    expect(logs.byEvt("process.unhandledRejection")).toHaveLength(1);
    expect(logs.byEvt("process.uncaughtException")[0]).toMatchObject({ level: "error" });
    expect(proc.exit).toHaveBeenCalledWith(1);
  });

  it("framework logger turns Colyseus console output into framework.log lines", () => {
    const logs = captureLogs();
    frameworkLogger.info("⚔️  Listening on", "http://localhost:2567");
    frameworkLogger.warn("");
    frameworkLogger.error("failed:", new Error("bad"));

    const lines = logs.byEvt("framework.log");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ level: "info", msg: "⚔️  Listening on http://localhost:2567" });
    expect(lines[1]).toMatchObject({ level: "error", msg: "failed:" });
  });
});
