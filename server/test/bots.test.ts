import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import type { CommandResult } from "@palikka/protocol";
import type { Placement } from "@palikka/rules";
import { placement } from "@palikka/rules/testing";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, join, legalMove, placeFree, waitingRoom, type TestClient } from "./support/game.js";

const addBot = (client: TestClient, seat: number) => client.request("addBot", { seat }) as Promise<CommandResult>;
const removeBot = (client: TestClient, seat: number) => client.request("removeBot", { seat }) as Promise<CommandResult>;
const botPlace = (client: TestClient, seat: number, move: Placement) => client.request("botPlace", { seat, ...move }) as Promise<CommandResult>;
const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];

interface DecodedPlayer {
  name: string;
  bot: boolean;
}
const seen = (client: TestClient) => client.state as { players: Map<string, DecodedPlayer> };

describe("bots in a room", () => {
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

  /** A waiting room with `people` seated and quick bot pauses. */
  async function room(people: number) {
    const game = await waitingRoom(colyseus, people);
    game.room.botDelayMs = 20;
    return game;
  }

  const holder = (room: GameRoom, seat: number) => [...room.state.players.values()].find((p) => p.seat === seat);

  describe("Adding and removing bots", () => {
    it("Host adds a bot: Kettu in seat 3, marked as a bot, and the host may start", async () => {
      const { room: r, clients } = await room(1);
      expect(await addBot(clients[0]!, 3)).toEqual({ ok: true });
      expect(holder(r, 3)).toMatchObject({ name: "Kettu", bot: true });
      await vi.waitFor(() => expect(seen(clients[0]!).players.get("bot:3")).toMatchObject({ name: "Kettu", bot: true }));
      expect(logs.byEvt("bot.added")).toEqual([expect.objectContaining({ seat: 3, name: "Kettu" })]);
      expect(logs.byEvt("cmd.accepted")).toEqual([expect.objectContaining({ cmd: "addBot" })]);
      expect(await clients[0]!.request("start", {})).toEqual({ ok: true });
    });

    it("Second bot gets the next name", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      await addBot(clients[0]!, 4);
      expect([holder(r, 2)?.name, holder(r, 4)?.name]).toEqual(["Kettu", "Ilves"]);
    });

    it("Guest tries to add a bot: NOT_HOST", async () => {
      const { room: r, clients } = await room(2);
      expect(await addBot(clients[1]!, 3)).toEqual({ ok: false, code: "NOT_HOST" });
      expect(await removeBot(clients[1]!, 3)).toEqual({ ok: false, code: "NOT_HOST" });
      expect(r.state.players.size).toBe(2);
    });

    it("Seat already taken: SEAT_TAKEN, also by a bot", async () => {
      const { clients } = await room(2);
      expect(await addBot(clients[0]!, 2)).toEqual({ ok: false, code: "SEAT_TAKEN" });
      await addBot(clients[0]!, 3);
      expect(await addBot(clients[0]!, 3)).toEqual({ ok: false, code: "SEAT_TAKEN" });
    });

    it("Host removes a bot, and a person joining gets that seat", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      expect(await removeBot(clients[0]!, 2)).toEqual({ ok: true });
      expect(holder(r, 2)).toBeUndefined();
      expect(logs.byEvt("bot.removed")).toEqual([expect.objectContaining({ seat: 2, name: "Kettu" })]);
      const guest = await join(colyseus, r, "Pekka");
      expect(r.state.players.get(guest.sessionId)?.seat).toBe(2);
    });

    it("Removing a person: NOT_A_BOT, and an empty seat too", async () => {
      const { room: r, clients } = await room(2);
      expect(await removeBot(clients[0]!, 2)).toEqual({ ok: false, code: "NOT_A_BOT" });
      expect(await removeBot(clients[0]!, 3)).toEqual({ ok: false, code: "NOT_A_BOT" });
      expect(holder(r, 2)?.name).toBe("Pekka");
    });

    it("No bots after the start: WRONG_PHASE", async () => {
      const { room: r, clients } = await room(2);
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      expect(await addBot(clients[0]!, 3)).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(await removeBot(clients[0]!, 2)).toEqual({ ok: false, code: "WRONG_PHASE" });
    });

    it("A seat being taken by a joining person: SEAT_TAKEN, and the person still gets it", async () => {
      const { room: r, clients } = await room(1);
      const reservation = await matchMaker.reserveSeatFor((await listing(r.roomId))!, { nickname: "Pekka" }, { nickname: "Pekka" });
      expect(await addBot(clients[0]!, 2)).toEqual({ ok: false, code: "SEAT_TAKEN" });
      expect(await addBot(clients[0]!, 3)).toEqual({ ok: true });
      const guest = await colyseus.sdk.consumeSeatReservation(reservation);
      expect(r.state.players.get(guest.sessionId)?.seat).toBe(2);
    });
  });

  describe("Listing with bots", () => {
    it("bots count as seated; a game full with bots is locked and unlisted; removing one lists it again", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      await vi.waitFor(async () => expect((await listing(r.roomId))?.metadata).toMatchObject({ seated: 2 }));
      await addBot(clients[0]!, 3);
      await addBot(clients[0]!, 4);
      await vi.waitFor(async () => {
        const entry = await listing(r.roomId);
        expect(entry?.metadata).toMatchObject({ seated: 4 });
        expect(entry?.locked).toBe(true);
      });
      await expect(colyseus.sdk.joinById(r.roomId, { nickname: "Pekka" })).rejects.toThrow();
      await removeBot(clients[0]!, 4);
      await vi.waitFor(async () => {
        const entry = await listing(r.roomId);
        expect(entry?.metadata).toMatchObject({ seated: 3 });
        expect(entry?.locked).toBe(false);
      });
      const guest = await colyseus.sdk.joinById(r.roomId, { nickname: "Pekka" });
      expect(r.state.players.get(guest.sessionId)?.seat).toBe(4);
    });
  });

  describe("Who computes bot moves", () => {
    it("Host runs the bots: the runner is the host's seat once the game starts", async () => {
      const { room: r, clients } = await room(2);
      await addBot(clients[0]!, 3);
      await clients[0]!.request("start", {});
      expect(r.state.botRunnerSeat).toBe(1);
      await vi.waitFor(() => expect((clients[1]!.state as { botRunnerSeat: number }).botRunnerSeat).toBe(1));
    });

    it("Host drops: seat 2 becomes the runner, and the host again after reconnecting", async () => {
      const { room: r, clients } = await room(2);
      await addBot(clients[0]!, 3);
      r.botDelayMs = 60_000;
      await clients[0]!.request("start", {});
      clients[0]!.reconnection.minUptime = 0;
      clients[0]!.connection.close(4010);
      await vi.waitFor(() => expect(r.state.botRunnerSeat).toBe(2));
      await vi.waitFor(() => expect(logs.byEvt("player.reconnected")).toHaveLength(1), { timeout: 10_000 });
      expect(r.state.botRunnerSeat).toBe(1);
      expect(logs.byEvt("bot.runner")).toEqual([
        expect.objectContaining({ from: 1, to: 2 }),
        expect.objectContaining({ from: 2, to: 1 }),
      ]);
    });
  });

  describe("Bot moves are validated", () => {
    /** Host (seat 1) and Pekka (seat 2) with a bot in seat 3 on turn; the server never moves for it. */
    async function botOnTurn() {
      const game = await room(2);
      await addBot(game.clients[0]!, 3);
      game.room.botDelayMs = 60_000;
      forceStartSeat(game.room, 3);
      await game.clients[0]!.request("start", {});
      return game;
    }

    it("Runner moves for a bot: accepted, audited with the seat, and the next colour is on turn", async () => {
      const { room: r, clients } = await botOnTurn();
      expect(await botPlace(clients[0]!, 3, legalMove(r, 3))).toEqual({ ok: true });
      expect(r.state.turnSeat).toBe(1);
      expect([...r.state.cells].filter((c) => c === 3).length).toBeGreaterThan(0);
      expect(logs.byEvt("cmd.accepted").filter((l) => l.cmd === "botPlace")).toEqual([expect.objectContaining({ player: clients[0]!.sessionId })]);
      expect(logs.byEvt("bot.fallback")).toHaveLength(0);
    });

    it("Someone else sends a bot move: NOT_BOT_RUNNER", async () => {
      const { room: r, clients } = await botOnTurn();
      expect(await botPlace(clients[1]!, 3, legalMove(r, 3))).toEqual({ ok: false, code: "NOT_BOT_RUNNER" });
      expect(r.state.turnSeat).toBe(3);
    });

    it("Not a bot's seat: NOT_BOT_SEAT for a seat a connected person plays", async () => {
      const { room: r, clients } = await botOnTurn();
      expect(await botPlace(clients[0]!, 2, legalMove(r, 2))).toEqual({ ok: false, code: "NOT_BOT_SEAT" });
    });

    it("A bot not on turn, an illegal move, and before the start", async () => {
      const { room: r, clients } = await botOnTurn();
      expect(await botPlace(clients[0]!, 3, placement("I1", ["#"], 5, 5))).toEqual({ ok: false, code: "NOT_ON_START" });
      expect([...r.state.cells].every((c) => c === 0)).toBe(true);
      expect(await botPlace(clients[0]!, 3, legalMove(r, 3))).toEqual({ ok: true });
      expect(await botPlace(clients[0]!, 3, legalMove(r, 3))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
      const waiting = await room(1);
      expect(await botPlace(waiting.clients[0]!, 3, placement("I1", ["#"], 19, 19))).toEqual({ ok: false, code: "WRONG_PHASE" });
    });
  });

  describe("Server fallback", () => {
    it("Runner silent: the server moves for the bot after the pause and the grace time, audited as the bot", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      r.botRunnerGraceMs = 30;
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      expect(await placeFree(clients[0]!, r)).toEqual({ ok: true });
      expect(r.state.turnSeat).toBe(2);
      await vi.waitFor(() => expect(r.state.turnSeat).toBe(1));
      const botLines = logs.byEvt("cmd.accepted").filter((l) => l.bot === true);
      expect(botLines.map((l) => [l.cmd, l.player, l.seat])).toEqual([["place", "bot:2", 2]]);
      expect(logs.byEvt("bot.fallback")).toEqual([expect.objectContaining({ level: "warn", reason: "runnerSilent", seat: 2, runner: 1 })]);
      expect(r.state.colours[1]!.pieces.length).toBe(1);
    });

    it("No runner: with every person dropped the server plays the bots after the pause", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      r.botRunnerGraceMs = 60_000;
      forceStartSeat(r, 2);
      await clients[0]!.request("start", {});
      clients[0]!.connection.close(1000);
      await vi.waitFor(() => expect(r.state.botRunnerSeat).toBe(0));
      await vi.waitFor(() => expect(logs.byEvt("bot.fallback").length).toBeGreaterThanOrEqual(2));
      expect(logs.byEvt("bot.fallback").every((l) => l.reason === "noRunner")).toBe(true);
    });

    it("the host plus a bot play the game to its end", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 3);
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      while (r.state.phase !== "finished") {
        await vi.waitFor(() => expect(r.state.turnSeat === 1 || r.state.phase === "finished").toBe(true));
        if (r.state.phase === "finished") break;
        expect(await placeFree(clients[0]!, r)).toEqual({ ok: true });
      }
      expect(r.state.winners.length).toBeGreaterThan(0);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "complete" })]);
    }, 20_000);
  });

  describe("Quick game against bots", () => {
    it("Too many bots: games with bots at creation are not made on the server (they run on the device)", async () => {
      await expect(colyseus.sdk.create("game", { nickname: "Maija", bots: 4 })).rejects.toThrow("INVALID_OPTIONS");
      expect(logs.byEvt("room.created")).toHaveLength(0);
      expect(logs.byEvt("room.refused")).toEqual([expect.objectContaining({ reason: "options" })]);
    });
  });

  describe("Game ends without people", () => {
    it("Solo player leaves a bot game: it ends without a winner and nothing more happens", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      await addBot(clients[0]!, 3);
      r.botDelayMs = 100;
      forceStartSeat(r, 2);
      await clients[0]!.request("start", {});
      await clients[0]!.leave(true);
      await vi.waitFor(() => expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "noPeople", winners: [] })]));
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(logs.byEvt("cmd.accepted").filter((l) => l.bot === true)).toHaveLength(0);
    });

    it("One of two people leaves: the game goes on between the other person and the bot", async () => {
      const { room: r, clients } = await room(2);
      await addBot(clients[0]!, 3);
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      await clients[1]!.leave(true);
      await vi.waitFor(() => expect(r.state.players.size).toBe(2));
      expect(r.state.phase).not.toBe("finished");
    });

    it("Person kicks the only bot: the person wins as the last player standing", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      r.botDelayMs = 60_000;
      r.turnLimitMs = 50;
      forceStartSeat(r, 2);
      await clients[0]!.request("start", {});
      await vi.waitFor(() => expect(r.state.turnExpired).toBe(true));
      expect(await clients[0]!.request("kick", { seat: 2 })).toEqual({ ok: true });
      expect([...r.state.winners]).toEqual([1]);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "lastPlayer", winners: [1] })]);
    });
  });
});
