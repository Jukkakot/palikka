import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import { MAX_SPECTATORS, type CommandResult } from "@game-kit/protocol";
import appConfig from "./support/app.js";
import { configureLogger } from "../src/index.js";
import type { GameRoom } from "./support/game.js";
import { captureLogs } from "./support/captureLogs.js";
import { startedGame, waitingRoom, type TestClient } from "./support/game.js";

interface DecodedPlayer {
  name: string;
  seat: number;
  target?: string;
}
interface DecodedState {
  players: Map<string, DecodedPlayer>;
  spectators: number;
  botSpeed: number;
  phase: string;
  winners: number[];
}
const seen = (client: TestClient) => client.state as DecodedState;
const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];

describe("spectators", () => {
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

  /** POST /watch as the client does (JSON as text/plain); resolves the HTTP status and body. */
  async function postWatch(body: unknown): Promise<{ status: number; data: unknown }> {
    try {
      const res = await colyseus.http.post("/watch", { body: JSON.stringify(body), headers: { "Content-Type": "text/plain" } });
      return { status: res.statusCode, data: res.data };
    } catch (err) {
      const { statusCode, data } = err as { statusCode: number; data: unknown };
      return { status: statusCode, data };
    }
  }

  /** Joins `roomId` as a spectator through the watch route. */
  async function watch(roomId: string, nickname = "Katsoja"): Promise<TestClient> {
    const res = await postWatch({ roomId, nickname });
    expect(res.status).toBe(200);
    return (await colyseus.sdk.consumeSeatReservation(res.data as never)) as unknown as TestClient;
  }

  const quick = (room: GameRoom) => {
    room.botDelayMs = 20;
  };

  describe("Running games to watch", () => {
    it("A started game is listed as watchable, a waiting one is not", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      expect((await listing(room.roomId))?.metadata).toMatchObject({ open: true, watchable: false });
      await clients[0]!.request("start", {});
      await vi.waitFor(async () => expect((await listing(room.roomId))?.metadata).toMatchObject({ open: false, watchable: true, seated: 3 }));
    });

    it("Watch from the list: the spectator sees the board, no seat is taken", async () => {
      const { room } = await startedGame(colyseus, 2);
      const spectator = await watch(room.roomId);
      expect(room.state.players.size).toBe(2);
      expect(room.state.spectators).toBe(1);
      await vi.waitFor(() => expect(seen(spectator).players.size).toBe(2));
      expect(logs.byEvt("spectator.joined")).toEqual([expect.objectContaining({ spectators: 1 })]);
    });

    it("Finished game disappears: not watchable any more", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.phase).toBe("finished"));
      await vi.waitFor(async () => expect((await listing(room.roomId))?.metadata).toMatchObject({ watchable: false }));
      expect((await postWatch({ roomId: room.roomId, nickname: "Katsoja" })).status).toBe(409);
    });

    it("refuses a waiting game, an unknown game and a bad body", async () => {
      const { room } = await waitingRoom(colyseus, 1);
      expect((await postWatch({ roomId: room.roomId, nickname: "Katsoja" })).status).toBe(409);
      expect((await postWatch({ roomId: "no-such-game", nickname: "Katsoja" })).status).toBe(404);
      expect((await postWatch({ roomId: room.roomId, nickname: "K" })).status).toBe(400);
      expect(room.state.spectators).toBe(0);
    });

    it(`admits at most ${MAX_SPECTATORS} spectators`, async () => {
      const { room } = await startedGame(colyseus, 2);
      for (let i = 0; i < MAX_SPECTATORS; i++) await watch(room.roomId);
      expect(room.state.spectators).toBe(MAX_SPECTATORS);
      await vi.waitFor(async () => expect((await listing(room.roomId))?.metadata).toMatchObject({ watchable: false }));
      expect((await postWatch({ roomId: room.roomId, nickname: "Katsoja" })).status).toBe(409);
    });
  });

  describe("What a spectator sees", () => {
    it("Spectator tries to act: NOT_SEATED for every command, nothing changes", async () => {
      const { room } = await startedGame(colyseus, 2);
      const spectator = await watch(room.roomId);
      expect(await spectator.request("move", { move: 0 })).toEqual({ ok: false, code: "NOT_SEATED" });
      expect(await spectator.request("kick", { seat: 1 })).toEqual({ ok: false, code: "NOT_SEATED" });
      expect(await spectator.request("rematch", {})).toEqual({ ok: false, code: "NOT_SEATED" });
      expect(room.state.phase).toBe("play");
    });

    it("Spectator leaves: the count drops and the game goes on", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      const spectator = await watch(room.roomId);
      await spectator.leave();
      await vi.waitFor(() => expect(seen(clients[0]!).spectators).toBe(0));
      expect(room.state.phase).toBe("play");
      expect(logs.byEvt("spectator.left")).toEqual([expect.objectContaining({ spectators: 0 })]);
    });
  });

  /** A running game of `bots` bots and one spectator: its only person started it and left. */
  async function botOnlyGame(bots: number): Promise<{ room: GameRoom; spectator: TestClient }> {
    const { room, clients } = await waitingRoom(colyseus, 1);
    quick(room);
    for (let seat = 2; seat <= bots + 1; seat++) await clients[0]!.request("addBot", { seat });
    await clients[0]!.request("start", {});
    const spectator = await watch(room.roomId);
    await clients[0]!.leave();
    await vi.waitFor(() => expect(room.state.players.size).toBe(bots));
    return { room, spectator };
  }

  describe("Watching a game of bots", () => {
    it("One bot is not a game: games of bots to watch are never created on the server", async () => {
      await expect(colyseus.sdk.create("game", { nickname: "Katsoja", watch: true, bots: 3 })).rejects.toThrow("INVALID_OPTIONS");
      await expect(colyseus.sdk.create("game", { nickname: "Katsoja", watch: true })).rejects.toThrow("INVALID_OPTIONS");
      expect(logs.byEvt("room.created")).toHaveLength(0);
    });

    it("Last spectator leaves a bot-only game: it ends without a winner", async () => {
      const { room, spectator } = await botOnlyGame(2);
      await spectator.leave();
      await vi.waitFor(() => expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ winners: [], reason: "noPeople" })]));
      expect([...room.state.winners]).toEqual([]);
    });

    it("Bots play on for a spectator after the only person left", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      quick(room);
      await clients[0]!.request("addBot", { seat: 2 });
      await clients[0]!.request("addBot", { seat: 3 });
      await clients[0]!.request("start", {});
      const spectator = await watch(room.roomId);
      await clients[0]!.leave();
      await vi.waitFor(() => expect(room.state.players.size).toBe(2));
      expect(room.state.phase).not.toBe("finished");
      const moves = () => logs.byEvt("cmd.accepted").filter((l) => l.cmd === "move").length;
      const before = moves();
      await vi.waitFor(() => expect(moves()).toBeGreaterThan(before));
      await spectator.leave();
      await vi.waitFor(() => expect(room.state.phase).toBe("finished"));
    });
  });

  describe("Bot speed", () => {
    it("Faster bots: a spectator of a bot-only game sets 4×, everyone sees it, pauses shrink", async () => {
      const { room, spectator } = await botOnlyGame(2);
      expect(room.state.botSpeed).toBe(1);
      expect(await spectator.request("setSpeed", { speed: 4 })).toEqual({ ok: true } satisfies CommandResult);
      await vi.waitFor(() => expect(seen(spectator).botSpeed).toBe(4));
      const other = await watch(room.roomId);
      await vi.waitFor(() => expect(seen(other).botSpeed).toBe(4));
      expect((room as unknown as { botDelay(ms: number): number }).botDelay(1500)).toBe(375);
    });

    it("Not while people play: PEOPLE_PLAYING; players get NOT_SPECTATOR", async () => {
      const { room, clients } = await startedGame(colyseus, 2);
      const spectator = await watch(room.roomId);
      expect(await spectator.request("setSpeed", { speed: 2 })).toEqual({ ok: false, code: "PEOPLE_PLAYING" });
      expect(await clients[0]!.request("setSpeed", { speed: 2 })).toEqual({ ok: false, code: "NOT_SPECTATOR" });
      expect(room.state.botSpeed).toBe(1);
    });
  });
});
