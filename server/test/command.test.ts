import { schema, t, type SchemaType } from "@colyseus/schema";
import type { CommandResult } from "@labyrinth/protocol";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { z } from "zod";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import { CommandRejection, type Actor } from "../src/rooms/command.js";
import { LoggedRoom } from "../src/rooms/LoggedRoom.js";
import { captureLogs } from "./support/captureLogs.js";

const CounterState = schema({ count: t.number().default(0) });
type CounterState = SchemaType<typeof CounterState>;

/** Test-only room: `add` is accepted up to 10, rejected above, and 13 crashes. */
class CounterRoom extends LoggedRoom<{ state: CounterState }> {
  state = new CounterState();

  messages = {
    add: this.command("add", z.object({ by: z.number().int() }), (_actor: Actor, { by }) => {
      if (by === 13) throw new Error("unlucky");
      if (by > 10) throw new CommandRejection("TOO_BIG", { limit: 10 });
      this.state.count += by;
    }),
  };

  protected commandStateFacts() {
    return { phase: "TEST", count: this.state.count };
  }
}

describe("observability › Room command audit and rejection contract", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  let logs: ReturnType<typeof captureLogs>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
    colyseus.server.define("counter", CounterRoom);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    logs = captureLogs();
  });

  async function setup() {
    const room = (await colyseus.createRoom("counter", {})) as unknown as CounterRoom;
    const client = await colyseus.connectTo(room);
    logs.clear();
    const send = (payload: unknown) => client.request("add", payload) as Promise<CommandResult>;
    const audit = () => logs.lines().filter((l) => l.evt.startsWith("cmd."));
    return { room, client, send, audit };
  }

  it("Accepted command", async () => {
    const { room, client, send, audit } = await setup();

    expect(await send({ by: 2 })).toEqual({ ok: true });
    expect(room.state.count).toBe(2);
    expect(audit()).toHaveLength(1);
    expect(audit()[0]).toMatchObject({
      level: "info",
      evt: "cmd.accepted",
      room: room.roomId,
      player: client.sessionId,
      cmd: "add",
      durMs: expect.any(Number),
    });
    expect(audit()[0]).not.toHaveProperty("bot");
  });

  it("a bot actor goes through the same wrapper, its line marked as a bot's", async () => {
    const { room, audit } = await setup();
    expect(await room.messages.add({ sessionId: "bot:2", bot: true }, { by: 3 })).toEqual({ ok: true });
    expect(await room.messages.add({ sessionId: "bot:2", bot: true }, { by: 11 })).toEqual({ ok: false, code: "TOO_BIG" });
    expect(audit()).toEqual([
      expect.objectContaining({ evt: "cmd.accepted", player: "bot:2", bot: true }),
      expect.objectContaining({ evt: "cmd.rejected", player: "bot:2", bot: true, code: "TOO_BIG" }),
    ]);
  });

  it("Rule violation", async () => {
    const { room, send, audit } = await setup();

    expect(await send({ by: 11 })).toEqual({ ok: false, code: "TOO_BIG" });
    expect(room.state.count).toBe(0);
    expect(audit()).toHaveLength(1);
    expect(audit()[0]).toMatchObject({
      level: "warn",
      evt: "cmd.rejected",
      code: "TOO_BIG",
      phase: "TEST",
      count: 0,
      limit: 10,
    });
  });

  it("Malformed payload", async () => {
    const { room, send, audit } = await setup();

    expect(await send({ by: "two" })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(room.state.count).toBe(0);
    expect(audit()).toHaveLength(1);
    expect(audit()[0]).toMatchObject({ evt: "cmd.rejected", code: "INVALID_COMMAND" });
  });

  it("Unexpected exception", async () => {
    const { room, send, audit } = await setup();

    expect(await send({ by: 13 })).toEqual({ ok: false, code: "INTERNAL_ERROR" });
    expect(audit()).toHaveLength(1);
    expect(audit()[0]).toMatchObject({ level: "error", evt: "cmd.failed" });
    expect((audit()[0]!.err as { stack: string }).stack).toContain("unlucky");

    // The room keeps working for everyone.
    expect(await send({ by: 1 })).toEqual({ ok: true });
    expect(room.state.count).toBe(1);
  });
});
