import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import appConfig from "./support/app.js";
import { configureLogger } from "../src/index.js";
import { MAX_OPEN_GAMES } from "../src/index.js";
import { ConnectFourRoom as GameRoom } from "./support/app.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, join, startedGame, waitingRoom, type TestClient } from "./support/game.js";

const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];
/** Ends a running game as a win of `seat` (a real win needs many turns; the rematch only needs "finished"). */
const finish = (room: GameRoom, seat: number) => (room as unknown as { finish(w: number[], r: string): void }).finish([seat], "home");
const roomOf = (colyseus: ColyseusTestServer<typeof appConfig>, id: string) => colyseus.getRoomById(id) as unknown as GameRoom;

describe("rematch", () => {
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
  afterEach(() => {
    GameRoom.maxOpenGames = MAX_OPEN_GAMES;
  });

  /** A finished public game of Maija (seat 1), Pekka (seat 2) and Kettu (seat 3). */
  async function finishedGame(create: Record<string, unknown> = {}) {
    const game = await waitingRoom(colyseus, 2, { create });
    await game.clients[0]!.request("addBot", { seat: 3 });
    forceStartSeat(game.room, 1);
    await game.clients[0]!.request("start", {});
    finish(game.room, 1);
    return game;
  }

  /** The rematch id the finished room synced to `client`. */
  const rematchId = async (client: TestClient) => {
    let id = "";
    await vi.waitFor(() => {
      id = (client.state as { rematchRoomId: string }).rematchRoomId;
      expect(id).not.toBe("");
    });
    return id;
  };

  it("First player asks for a rematch: a new public waiting room with Kettu in seat 3, Maija hosts", async () => {
    const { room, clients } = await finishedGame();
    expect(await clients[0]!.request("rematch", {})).toEqual({ ok: true });
    const id = await rematchId(clients[0]!);
    const next = roomOf(colyseus, id);
    expect(next.state.phase).toBe("waiting");
    expect([...next.state.players.values()].map((p) => [p.seat, p.name, p.bot])).toEqual([[3, "Kettu", true]]);
    expect((await listing(id))?.private).toBe(false);
    const maija = await join(colyseus, next, "Maija");
    expect(next.state.players.get(maija.sessionId)?.seat).toBe(1);
    expect(next.state.hostSeat).toBe(1);
    expect(logs.byEvt("game.rematch")).toEqual([expect.objectContaining({ room: room.roomId, rematchRoom: id })]);
  });

  it("Second player follows: no second new game", async () => {
    const { clients } = await finishedGame();
    const [first, second] = await Promise.all([clients[0]!.request("rematch", {}), clients[1]!.request("rematch", {})]);
    expect([first, second]).toEqual([{ ok: true }, { ok: true }]);
    expect(logs.byEvt("game.rematch")).toHaveLength(1);
    const id = await rematchId(clients[1]!);
    const next = roomOf(colyseus, id);
    await join(colyseus, next, "Maija");
    const pekka = await join(colyseus, next, "Pekka");
    expect(next.state.players.get(pekka.sessionId)?.seat).toBe(2);
  });

  it("Rematch of a running game: WRONG_PHASE, no game", async () => {
    const { clients } = await startedGame(colyseus, 2);
    expect(await clients[0]!.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(logs.byEvt("game.rematch")).toHaveLength(0);
  });

  it("Server full: SERVER_FULL, and a later try still works", async () => {
    const { clients } = await finishedGame();
    GameRoom.maxOpenGames = GameRoom.openGames;
    expect(await clients[0]!.request("rematch", {})).toEqual({ ok: false, code: "SERVER_FULL" });
    GameRoom.maxOpenGames = MAX_OPEN_GAMES;
    expect(await clients[0]!.request("rematch", {})).toEqual({ ok: true });
  });

  it("a spectator joining a waiting room is refused", async () => {
    const { room } = await waitingRoom(colyseus, 1);
    await expect(colyseus.connectTo(room as never, { nickname: "Katsoja", watch: true })).rejects.toThrow("NOT_WATCHABLE");
    expect(room.state.spectators).toBe(0);
  });
});
