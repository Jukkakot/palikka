import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { CommandResult } from "@labyrinth/protocol";
import { treasureOf } from "@labyrinth/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import { captureLogs } from "./support/captureLogs.js";
import { arrange, forceStartSeat, gameOf, startedGame, waitingRoom, type TestClient } from "./support/game.js";

const LONG_MS = 60_000;

const setAutoplay = (client: TestClient, on: boolean) => client.request("setAutoplay", { on }) as Promise<CommandResult>;
const shift = (client: TestClient) => client.request("shift", { insertion: "N1", rotation: 0 }) as Promise<CommandResult>;

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
  async function game(people: number, { shiftMs = 20, moveMs = 20, disconnectSeconds = 300 } = {}) {
    const g = await startedGame(colyseus, people, { turnMs: LONG_MS, disconnectSeconds });
    g.room.botShiftDelayMs = shiftMs;
    g.room.botMoveDelayMs = moveMs;
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
      expect(room.state.phase).toBe("shift");
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
    it("Bot plays the turn: shift and move as a bot, the turn passes on", async () => {
      const { room, clients } = await game(2);
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      const me = room.state.players.get(clients[0]!.sessionId)!;
      expect(await shift(clients[0]!)).toEqual({ ok: true });
      expect(await clients[0]!.request("move", { row: me.row, col: me.col })).toEqual({ ok: true });

      await vi.waitFor(() => expect(room.state.turnSeat).toBe(1));
      expect(botCommands("shift")).toEqual([expect.objectContaining({ player: clients[1]!.sessionId, seat: 2 })]);
      expect(botCommands("move")).toHaveLength(1);
    });

    it("Handed over on the own turn before the shift: the bot plays all of it", async () => {
      const { room, clients } = await game(2);
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(botCommands("shift")).toHaveLength(1);
    });

    it("Handed over mid-turn: after the player's shift the bot only walks", async () => {
      const { room, clients } = await game(2);
      expect(await shift(clients[0]!)).toEqual({ ok: true });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(botCommands("shift")).toHaveLength(0);
      expect(botCommands("move")).toHaveLength(1);
    });

    it("Collecting: the bot collects the seat's own target", async () => {
      const { room, clients } = await game(2);
      expect(await shift(clients[0]!)).toEqual({ ok: true });
      // The pawn stands on a treasure that is its target: the bot walks (or stays) onto it.
      const i = gameOf(room).board.squares.findIndex((t) => treasureOf(t.id) !== undefined);
      const treasure = treasureOf(gameOf(room).board.squares[i]!.id)!;
      arrange(room, 1, { pawn: { row: Math.floor(i / 7), col: i % 7 }, target: treasure });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.turnSeat).toBe(2));
      expect(room.state.players.get(clients[0]!.sessionId)!.found).toContain(treasure);
    });

    it("Taken back before the shift: no step is made for the player", async () => {
      const { room, clients } = await game(2, { shiftMs: 150 });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      expect(await setAutoplay(clients[0]!, false)).toEqual({ ok: true });
      await pause(250);
      expect(room.state.phase).toBe("shift");
      expect(botCommands("shift")).toHaveLength(0);
      expect(await shift(clients[0]!)).toEqual({ ok: true });
    });

    it("Taken back after the bot's shift: the pawn does not move by itself", async () => {
      const { room, clients } = await game(2, { moveMs: 150 });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.phase).toBe("move"));
      expect(await setAutoplay(clients[0]!, false)).toEqual({ ok: true });
      await pause(250);
      expect(room.state.phase).toBe("move");
      expect(room.state.turnSeat).toBe(1);
      expect(botCommands("move")).toHaveLength(0);
    });

    it("Own command while auto-played: AUTOPLAYING, board unchanged", async () => {
      const { room, clients } = await game(2, { shiftMs: LONG_MS });
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      const before = room.state.spare.id;
      expect(await shift(clients[0]!)).toEqual({ ok: false, code: "AUTOPLAYING" });
      expect(room.state.spare.id).toBe(before);
      expect(room.state.phase).toBe("shift");
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
      expect(botCommands("shift")).toEqual([expect.objectContaining({ player: clients[0]!.sessionId })]);
    });

    it("Back in time: the drop's autoplay ends", async () => {
      const { room, clients, player } = await game(2, { shiftMs: LONG_MS });
      await drop(room, clients[1]!, true);
      await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
      expect(player(1).autoplay).toBe(false);
      expect(logs.byEvt("autoplay.changed").at(-1)).toMatchObject({ seat: 2, on: false, reason: "reconnect" });
    });

    it("Chosen autoplay survives a drop", async () => {
      const { room, clients, player } = await game(2, { shiftMs: LONG_MS });
      expect(await setAutoplay(clients[1]!, true)).toEqual({ ok: true });
      clients[1]!.reconnection.minUptime = 0;
      clients[1]!.connection.close(4010);
      await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
      expect(player(1).autoplay).toBe(true);
      expect(logs.byEvt("autoplay.changed")).toHaveLength(1);
      expect(room.state.phase).toBe("shift");
    });

    it("Dropped in the waiting room: auto-played from the start", async () => {
      const { room, clients, player } = await waitingRoom(colyseus, 3, { turnMs: LONG_MS });
      room.botShiftDelayMs = LONG_MS;
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
      r.botShiftDelayMs = 10;
      r.botMoveDelayMs = 10;
      await clients[0]!.request("addBot", { seat: 2 });
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      expect(await setAutoplay(clients[0]!, true)).toEqual({ ok: true });
      await vi.waitFor(() => expect(botCommands("move").length).toBeGreaterThanOrEqual(3));
      expect(r.state.winnerSeat === 0 ? r.state.phase : "won").not.toBe("finished");
    });
  });
});
