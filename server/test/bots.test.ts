import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { matchMaker } from "colyseus";
import type { CommandResult } from "@palikka/protocol";
import { chooseBotCell, type BotStrategy, type BotView } from "@palikka/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import { captureLogs } from "./support/captureLogs.js";
import { forceStartSeat, join, placeFree, waitingRoom, type TestClient } from "./support/game.js";

const addBot = (client: TestClient, seat: number) => client.request("addBot", { seat }) as Promise<CommandResult>;
const removeBot = (client: TestClient, seat: number) => client.request("removeBot", { seat }) as Promise<CommandResult>;
const listing = async (roomId: string) => (await matchMaker.query({ roomId }))[0];

interface DecodedPlayer {
  name: string;
  bot: boolean;
  placed: number;
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

  describe("Bots play their turns", () => {
    it("Bot's turn: it places by itself, audited as a bot, and the turn passes on", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      expect(await placeFree(clients[0]!, r)).toEqual({ ok: true });
      expect(r.state.turnSeat).toBe(2);
      await vi.waitFor(() => expect(r.state.turnSeat).toBe(1));
      const botLines = logs.byEvt("cmd.accepted").filter((l) => l.bot === true);
      expect(botLines.map((l) => [l.cmd, l.player, l.seat])).toEqual([["place", "bot:2", 2]]);
      expect(holder(r, 2)!.placed).toBe(1);
    });

    it("Bot starts the game and plays its first turn without anyone doing anything", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      forceStartSeat(r, 2);
      await clients[0]!.request("start", {});
      expect(r.state.turnSeat).toBe(2);
      await vi.waitFor(() => expect(r.state.turnSeat).toBe(1));
      expect([...r.state.cells].filter((c) => c === 2)).toHaveLength(1);
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
      expect(r.state.winnerSeat).toBeGreaterThan(0);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "complete" })]);
      expect(logs.byEvt("bot.fallback")).toHaveLength(0);
    });

    it("the bot's view holds the board and every seat's progress", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      const views: BotView[] = [];
      r.botStrategy = (view, rng) => {
        views.push(view);
        return chooseBotCell(view, rng);
      };
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      await placeFree(clients[0]!, r);
      await vi.waitFor(() => expect(views.length).toBeGreaterThan(0));
      expect(views[0]!.seat).toBe(2);
      expect(views[0]!.seats).toEqual([
        { seat: 1, placed: 1 },
        { seat: 2, placed: 0 },
      ]);
      expect(views[0]!.board.filter((c) => c === 1)).toHaveLength(1);
    });

    it("Fallback: a rejected choice logs bot.fallback, then the bot claims the first empty cell", async () => {
      const { room: r, clients } = await room(1);
      await addBot(clients[0]!, 2);
      // Always the top-left cell, which the person takes first.
      const bad: BotStrategy = () => ({ row: 0, col: 0 });
      r.botStrategy = bad;
      forceStartSeat(r, 1);
      await clients[0]!.request("start", {});
      await clients[0]!.request("place", { row: 0, col: 0 });
      await vi.waitFor(() => expect(r.state.turnSeat).toBe(1));
      expect(logs.byEvt("bot.fallback")).toEqual([expect.objectContaining({ level: "error", cmd: "place", code: "CELL_TAKEN", bot: true })]);
      expect(logs.byEvt("cmd.rejected")).toEqual([expect.objectContaining({ cmd: "place", player: "bot:2", bot: true })]);
      expect(r.state.cells[1]).toBe(2);
    });
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
      await vi.waitFor(() => expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "noPeople", winner: 0 })]));
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
      expect(r.state.winnerSeat).toBe(1);
      expect(logs.byEvt("game.finished")).toEqual([expect.objectContaining({ reason: "lastPlayer", winner: 1 })]);
    });
  });
});
