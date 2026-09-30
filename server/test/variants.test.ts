import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import { VARIANT_IDS as PROTOCOL_VARIANTS, type CommandResult } from "@palikka/protocol";
import { VARIANT_IDS } from "@palikka/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "@game-kit/server";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, join, legalMove, NAMES, placeFree, waitingRoom, type TestClient } from "./support/game.js";

const setVariant = (client: TestClient, variant: string) => client.request("setOptions", { options: { variant } }) as Promise<CommandResult>;
const addBot = (client: TestClient, seat: number) => client.request("addBot", { seat }) as Promise<CommandResult>;
const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];
const seats = (room: GameRoom) => [...room.state.players.values()].map((p) => [p.seat, p.bot] as const).sort(([a], [b]) => a - b);
/** Ends a running game as a win of `seat` (the rematch only needs "finished"). */
const finish = (room: GameRoom, seat: number) => (room as unknown as { finish(w: number[], r: string): void }).finish([seat], "complete");

describe("variants in a room", () => {
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

  /** A started game of `variant` with `people` seated in seats 1…n and colour 1 on turn. */
  async function started(variant: string, people: number) {
    const game = await waitingRoom(colyseus, people);
    expect(await setVariant(game.clients[0]!, variant)).toEqual({ ok: true });
    forceStartSeat(game.room, 1);
    expect(await game.clients[0]!.request("start", {})).toEqual({ ok: true });
    return game;
  }

  it("protocol and rules agree on the variant ids", () => {
    expect(PROTOCOL_VARIANTS).toEqual(VARIANT_IDS);
  });

  describe("Choosing the variant", () => {
    it("a new game is Perus", async () => {
      const { room } = await waitingRoom(colyseus, 1);
      expect(room.state.game.variant).toBe("classic");
      expect((await listing(room.roomId))?.metadata).toMatchObject({ options: { variant: "classic" } });
    });

    it("Host picks Duo: every client sees it, the board is 14×14 and one more player fits", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      expect(await setVariant(clients[0]!, "duo")).toEqual({ ok: true });
      await vi.waitFor(() => expect((clients[0]!.state as { game: { variant: string } }).game.variant).toBe("duo"));
      expect(room.state.game.cells.length).toBe(196);
      await vi.waitFor(async () => expect((await listing(room.roomId))?.metadata).toMatchObject({ options: { variant: "duo" } }));
      const pekka = await join(colyseus, room, NAMES[1]);
      expect(room.state.players.get(pekka.sessionId)?.seat).toBe(2);
      await vi.waitFor(() => expect((pekka.state as { game: { variant: string } }).game.variant).toBe("duo"));
      await expect(join(colyseus, room, NAMES[2])).rejects.toThrow();
      expect(logs.byEvt("options.changed")).toEqual([expect.objectContaining({ from: { variant: "classic" }, to: { variant: "duo" } })]);
    });

    it("Too many people: TOO_MANY_PLAYERS and the variant stays", async () => {
      const { room, clients } = await waitingRoom(colyseus, 3);
      expect(await setVariant(clients[0]!, "duo")).toEqual({ ok: false, code: "TOO_MANY_PLAYERS" });
      expect(room.state.game.variant).toBe("classic");
      expect(room.state.game.cells.length).toBe(400);
    });

    it("Bots make room: the bot in seat 3 goes when the host picks Tuplaväri", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      await addBot(clients[0]!, 2);
      await addBot(clients[0]!, 3);
      expect(await setVariant(clients[0]!, "double")).toEqual({ ok: true });
      expect(room.state.game.variant).toBe("double");
      expect(seats(room)).toEqual([[1, false], [2, true]]);
      expect(await addBot(clients[0]!, 3)).toEqual({ ok: false, code: "SEAT_TAKEN" });
      expect(logs.byEvt("bot.removed")).toEqual([expect.objectContaining({ seat: 3, reason: "options" })]);
    });

    it("only the host, only in the waiting room", async () => {
      const { clients } = await waitingRoom(colyseus, 2);
      expect(await setVariant(clients[1]!, "duo")).toEqual({ ok: false, code: "NOT_HOST" });
      expect(await setVariant(clients[0]!, "junior")).toEqual({ ok: false, code: "INVALID_COMMAND" });
      const game = await started("duo", 2);
      expect(await setVariant(game.clients[0]!, "classic")).toEqual({ ok: false, code: "WRONG_PHASE" });
    });

    it("Kolmikko needs three: the start is refused with two seats", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      await addBot(clients[0]!, 2);
      expect(await setVariant(clients[0]!, "trio")).toEqual({ ok: true });
      expect(await clients[0]!.request("start", {})).toEqual({ ok: false, code: "NOT_ENOUGH_PLAYERS" });
      expect(room.state.phase).toBe("waiting");
    });

    it("a rematch keeps the variant", async () => {
      const { room, clients } = await started("duo", 2);
      finish(room, 1);
      expect(await clients[0]!.request("rematch", {})).toEqual({ ok: true });
      await vi.waitFor(() => expect(room.state.rematchRoomId).not.toBe(""));
      const next = colyseus.getRoomById(room.state.rematchRoomId) as unknown as GameRoom;
      expect(next.state.game.variant).toBe("duo");
      expect(next.state.game.cells.length).toBe(196);
    });
  });

  describe("Playing a variant", () => {
    it("Second colour: in Tuplaväri seat 1 plays colour 3", async () => {
      const { room, clients } = await started("double", 2);
      expect([...room.state.game.colours].map((c) => [c.colour, c.seat])).toEqual([[1, 1], [2, 2], [3, 1], [4, 2]]);
      expect(await placeFree(clients[0]!, room)).toEqual({ ok: true });
      expect(await placeFree(clients[1]!, room)).toEqual({ ok: true });
      expect([room.state.game.turnColour, room.state.turnSeat]).toEqual([3, 1]);
      expect(await clients[0]!.request("move", { move: legalMove(room) })).toEqual({ ok: true });
      expect([...room.state.game.cells].filter((c) => c === 3).length).toBeGreaterThan(0);
      expect(logs.byEvt("turn.changed").map((l) => [l.to, l.colour])).toEqual([[1, 1], [2, 2], [1, 3], [2, 4]]);
      expect(logs.byEvt("phase.changed").find((l) => l.to === "play")).toMatchObject({ variant: "double" });
    });

    it("Shared colour's turn: seat 1 plays colour 4's first piece, seat 2 may not", async () => {
      const { room, clients } = await started("trio", 3);
      expect(room.state.game.colours.at(3)!.seat).toBe(0);
      for (const client of clients) expect(await placeFree(client, room)).toEqual({ ok: true });
      expect([room.state.game.turnColour, room.state.turnSeat]).toEqual([4, 1]);
      expect(await clients[1]!.request("move", { move: legalMove(room) })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
      expect(await clients[0]!.request("move", { move: legalMove(room) })).toEqual({ ok: true });
      expect(room.state.game.colours.at(3)!.pieces.length).toBe(1);
      expect([room.state.game.turnColour, room.state.turnSeat]).toEqual([1, 1]);
    });

    it("Bot plays the shared colour: the runner's move for the bot seat is accepted in colour 4", async () => {
      const { room, clients } = await waitingRoom(colyseus, 1);
      room.botDelayMs = 60_000;
      await addBot(clients[0]!, 2);
      await addBot(clients[0]!, 3);
      await setVariant(clients[0]!, "trio");
      forceStartSeat(room, 1);
      await clients[0]!.request("start", {});
      const host = clients[0]!;
      const botMove = (seat: number) => host.request("botMove", { seat, move: legalMove(room) });
      expect(await placeFree(host, room)).toEqual({ ok: true }); // colour 1
      expect(await botMove(2)).toEqual({ ok: true }); // colour 2
      expect(await botMove(3)).toEqual({ ok: true }); // colour 3
      expect(await placeFree(host, room)).toEqual({ ok: true }); // colour 4, seat 1's piece
      expect(await placeFree(host, room)).toEqual({ ok: true }); // colour 1
      expect(await botMove(2)).toEqual({ ok: true });
      expect(await botMove(3)).toEqual({ ok: true });
      expect([room.state.game.turnColour, room.state.turnSeat]).toEqual([4, 2]);
      expect(await botMove(2)).toEqual({ ok: true });
      expect(room.state.game.colours.at(3)!.pieces.length).toBe(2);
    });

    it("Tuplaväri leaver: colours 2 and 4 are out, the game ends and seat 1 wins", async () => {
      const { room, clients } = await started("double", 2);
      await clients[1]!.leave();
      await vi.waitFor(() => expect(room.state.phase).toBe("finished"));
      expect([...room.state.winners]).toEqual([1]);
      expect([...room.state.game.colours].filter((c) => c.left).map((c) => c.colour)).toEqual([2, 4]);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "lastPlayer", winners: [1] })]);
    });

    it("Duo: the first move covers row 5, column 5", async () => {
      const { room, clients } = await started("duo", 2);
      expect(await clients[0]!.request("move", { move: { piece: 0, orientation: 0, row: 0, col: 0 } })).toEqual({ ok: false, code: "NOT_ON_START" });
      expect(await clients[0]!.request("move", { move: { piece: 0, orientation: 0, row: 4, col: 4 } })).toEqual({ ok: true });
      expect(room.state.game.cells[4 * 14 + 4]).toBe(1);
    });
  });
});
