import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { CommandResult } from "@game-kit/protocol";
import appConfig from "./support/app.js";
import { configureLogger } from "../src/index.js";
import type { GameRoom } from "./support/game.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, placeFree, startedGame, waitingRoom, type TestClient } from "./support/game.js";

const LONG_MS = 60_000;

const setAutoplay = (client: TestClient, on: boolean) => client.request("setAutoplay", { on }) as Promise<CommandResult>;

describe("autoplay in a room", () => {
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

  /** A started game of `people` (seat 1 on turn) with quick bot pauses. */
  async function game(people: number, { botMs = 20, disconnectSeconds = 300 } = {}) {
    const g = await startedGame(colyseus, people, { turnMs: LONG_MS, disconnectSeconds });
    g.room.botDelayMs = botMs;
    return g;
  }

  const botCommands = (cmd: string) => logs.byEvt("cmd.accepted").filter((l) => l.bot === true && l.cmd === cmd);
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  describe("Handing the seat to the bot", () => {
    it("Hand over and take back: synced, logged, idempotent", async () => {
      const { room, clients, player } = await game(2);
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      expect(player(1).autoplay).toBe(true);
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect((clients[0]!.state as { players: Map<string, { autoplay: boolean }> }).players.get(clients[1]!.sessionId)?.autoplay).toBe(true));

      expect(await setAutoplay(clients[1]!, false)).toEqual({ ok: true });
      expect(await setAutoplay(clients[1]!, false)).toEqual({ ok: true });
      expect(player(1).autoplay).toBe(false);
      expect(logs.byEvt("autoplay.changed")).toEqual([
        expect.objectContaining({ seat: 2, on: true, reason: "player" }),
        expect.objectContaining({ seat: 2, on: false, reason: "player" }),
      ]);
      expect(room.state.phase).toBe("play");
    });

    it("Before the start: WRONG_PHASE", async () => {
      const { clients, player } = await waitingRoom(colyseus, 2);
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(player(0).autoplay).toBe(false);
    });

    it("After the end: WRONG_PHASE", async () => {
      const { room, clients } = await game(2);
      room.state.phase = "finished";
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: false, code: "WRONG_PHASE" });
    });

    it("Spectator: NOT_SEATED", async () => {
      const { room } = await game(2);
      // A running game admits spectators through the watch route only.
      const res = await colyseus.http.post("/watch", {
        body: JSON.stringify({ roomId: room.roomId, nickname: "Katsoja" }),
        headers: { "Content-Type": "text/plain" },
      });
      const watcher = (await colyseus.sdk.consumeSeatReservation(res.data as never)) as unknown as TestClient;
      expect(await setAutoplay(watcher, true)).toEqual({ ok: false, code: "NOT_SEATED" });
    });
  });

  describe("Bot plays an auto-played seat", () => {
    it("Bot plays the turn: places as a bot, the turn passes on", async () => {
      const { room, clients } = await game(2);
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      expect(await placeFree(clients[0]!, room)).toEqual({ ok: true });

      await vi.waitFor(() => expect(room.state.turnSeat).toBe(1));
      expect(botCommands("move")).toEqual([expect.objectContaining({ player: clients[1]!.sessionId, seat: 2 })]);
    });

    it("Handed over on the own turn: the bot plays it", async () => {
      const { room, clients } = await game(2);
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(botCommands("move")).toHaveLength(1);
    });

    it("Taken back before the bot's pause ends: no turn is played for the player", async () => {
      const { room, clients } = await game(2, { botMs: 150 });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      expect(await setAutoplay(clients[0]!, false)).toEqual({ ok: true });
      await pause(250);
      expect(room.state.turnSeat).toBe(1);
      expect(botCommands("move")).toHaveLength(0);
      expect(await placeFree(clients[0]!, room)).toEqual({ ok: true });
    });

    it("Own command while auto-played: AUTOPLAYING, board unchanged", async () => {
      const { room, clients } = await game(2, { botMs: LONG_MS });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      expect(await placeFree(clients[0]!, room)).toEqual({ ok: false, code: "AUTOPLAYING" });
      expect([...room.state.game.cells].every((c) => c === 0)).toBe(true);
      expect(room.state.phase).toBe("play");
    });
  });

  describe("Dropped player auto-played", () => {
    /** Closes the client's connection as a network loss would; the SDK reconnects when `back`. */
    async function drop(room: GameRoom, client: TestClient, back: boolean) {
      if (back) client.reconnection.minUptime = 0;
      client.connection.close(back ? 4010 : 1000);
      await vi.waitFor(() => expect(room.state.players.get(client.sessionId)?.autoplay).toBe(true));
    }

    it("Connection drops: the bot plays the turn", async () => {
      const { room, clients } = await game(2);
      await drop(room, clients[0]!, false);
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(logs.byEvt("autoplay.changed")).toEqual([expect.objectContaining({ seat: 1, on: true, reason: "drop" })]);
      expect(botCommands("move")).toEqual([expect.objectContaining({ player: clients[0]!.sessionId })]);
    });

    it("Back in time: the drop's autoplay ends", async () => {
      const { room, clients, player } = await game(2, { botMs: LONG_MS });
      await drop(room, clients[1]!, true);
      await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
      expect(player(1).autoplay).toBe(false);
      expect(logs.byEvt("autoplay.changed").at(-1)).toMatchObject({ seat: 2, on: false, reason: "reconnect" });
    });

    it("Chosen autoplay survives a drop", async () => {
      const { room, clients, player } = await game(2, { botMs: LONG_MS });
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      clients[1]!.reconnection.minUptime = 0;
      clients[1]!.connection.close(4010);
      await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
      expect(player(1).autoplay).toBe(true);
      expect(logs.byEvt("autoplay.changed")).toHaveLength(1);
      expect(room.state.phase).toBe("play");
    });

    it("Dropped in the waiting room: auto-played from the start", async () => {
      const { room, clients, player } = await waitingRoom(colyseus, 3, { turnMs: LONG_MS });
      room.botDelayMs = LONG_MS;
      clients[2]!.connection.close(1000);
      await vi.waitFor(() => expect(player(2).connected).toBe(false));
      forceStartSeat(room, 1);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
      expect(player(2).autoplay).toBe(true);
    });

    it("Slow but connected: not auto-played", async () => {
      const { room, player } = await startedGame(colyseus, 2, { turnMs: 50 });
      await vi.waitFor(() => expect(room.state.turnExpired).toBe(true));
      expect(player(0).autoplay).toBe(false);
    });
  });

  describe("Auto-played players are people", () => {
    it("Everyone hands over: the game goes on", async () => {
      const { room: r, clients } = await waitingRoom(colyseus, 1, { turnMs: LONG_MS });
      r.botDelayMs = 10;
      await clients[0]!.request("addBot", { seat: 2 });
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(botCommands("move").length).toBeGreaterThanOrEqual(3));
      expect(r.state.phase).not.toBe("finished");
    });
  });
});
