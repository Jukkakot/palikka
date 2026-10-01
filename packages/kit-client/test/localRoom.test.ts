// @vitest-environment jsdom
import type { ConnectFourGame } from "@game-kit/protocol/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLocalGame as loadSaved } from "../src/session/localGameStore.ts";
import { BOT_DELAY_MS, LocalRoom, type LocalRoomDeps } from "../src/session/localRoom.ts";
import { toLobbyView } from "../src/session/lobbyView.ts";
import { loadResume, saveResume } from "../src/session/resumeRecord.ts";
import { createConnector } from "../src/session/useKitSession.ts";
import { connectFour, connectFourClient, firstFreeColumn, type AskConnectFourBot } from "./support/connectFour.ts";

type Deps = Partial<LocalRoomDeps> & { askBot?: AskConnectFourBot };

const quiet: Deps = { setTimeout: () => 0, clearTimeout: () => {} };
const create = (bots = 1, { askBot = firstFreeColumn, ...deps }: Deps = {}) =>
  LocalRoom.create(connectFourClient(askBot), "Maija", bots, {}, { seed: () => 7, ...deps });
const createWatch = (bots: number, { askBot = firstFreeColumn, ...deps }: Deps = {}) =>
  LocalRoom.createWatch(connectFourClient(askBot), bots, 1, {}, { seed: () => 7, ...deps });
const restore = (roomId: string) => LocalRoom.restore(connectFour, roomId, quiet);
const loadLocalGame = (roomId: string) => loadSaved<ConnectFourGame, object>(roomId, connectFour.local.save);
const viewOf = (room: { state: Parameters<typeof toLobbyView>[0]; roomId: string; sessionId: string }) => toLobbyView(room.state, room.roomId, room.sessionId);
/** Maija drops a disc in the first free column. */
const playFree = (room: { game: ConnectFourGame; request(type: string, payload: unknown): Promise<unknown> }) =>
  room.request("move", { move: Math.max(0, room.game.cells.findIndex((c, i) => i < 7 && c === 0)) });

/** Lets bot pauses run out (and their answers arrive) until `done`, at most `max` pauses. */
async function runBots(done: () => boolean, max = 200) {
  for (let i = 0; i < max && !done(); i++) await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("device-games › Game against bots on the device", () => {
  it("One against three: the player in seat 1 on turn, the bots after, no clock", () => {
    const view = viewOf(create(3, quiet));
    expect(view.seats.map((s) => [s.seat, s.name, s.isBot])).toEqual([
      [1, "Maija", false],
      [2, "Kettu", true],
      [3, "Ilves", true],
      [4, "Pöllö", true],
    ]);
    expect(view).toMatchObject({ phase: "playing", isMyTurn: true, turnSeat: 1, turnDeadline: 0, canKick: false, canUndo: true, undoable: false });
  });

  it("commands answer like the server, with the rules' refusals, and every step is saved", async () => {
    const room = create(1, quiet);
    expect(await room.request("move", { move: "x" })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(await room.request("move", { move: 3 })).toEqual({ ok: true });
    expect(await room.request("move", { move: 3 })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(await room.request("kick", { seat: 2 })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(loadLocalGame(room.roomId)?.game.cells[5 * 7 + 3]).toBe(1);
  });

  it("Bot answers: after the pause the bot moves and the player is on turn again; the game plays to its end", async () => {
    vi.useFakeTimers();
    const room = create(2);
    await playFree(room);
    expect(room.game.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 1);
    expect(room.game.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(room.game.turn).toBe(3);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.turn).toBe(1);
    for (let i = 0; i < 100 && !room.game.over; i++) {
      if (room.game.turn === 1) await playFree(room);
      else await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    }
    expect(viewOf(room)).toMatchObject({ finished: true });
  });

  it("Pause not stretched: the bot thinks during the pause, and a slow answer lands when it arrives", async () => {
    vi.useFakeTimers();
    const asked: { at: number; resolve(move: number | undefined): void }[] = [];
    const room = create(1, { askBot: () => new Promise((resolve) => asked.push({ at: Date.now(), resolve })) });
    const start = Date.now();
    await playFree(room);
    expect(asked.map((a) => a.at)).toEqual([start]);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS * 1.5);
    expect(room.game.turn).toBe(2);
    asked[0]!.resolve(4);
    await vi.advanceTimersByTimeAsync(0);
    expect(room.game.turn).toBe(1);
  });

  it("a refused bot move falls back to the rules' simple bot", async () => {
    vi.useFakeTimers();
    const room = create(1, { askBot: async () => 99 });
    await playFree(room);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.moves).toBe(2);
    expect(room.game.turn).toBe(1);
  });

  it("a restored game continues where it was; leaving forgets it", async () => {
    const room = create(1, quiet);
    await playFree(room);
    room.removeAllListeners();
    const restored = restore(room.roomId)!;
    expect([restored.game.turn, restored.game.moves]).toEqual([2, 1]);
    await restored.leave();
    expect(loadLocalGame(room.roomId)).toBeUndefined();
  });

  it("a broken or foreign save is dropped, not offered", () => {
    localStorage.setItem("test.localGame", JSON.stringify({ version: 2, roomId: "local-old", seats: [], options: {}, game: { board: [0, 0] } }));
    expect(restore("local-old")).toBeUndefined();
    expect(localStorage.getItem("test.localGame")).toBeNull();
  });

  it("Rematch: a finished game's rematch is a new saved game with the same seats", async () => {
    vi.useFakeTimers();
    const room = create(2);
    expect(await room.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    // The bot plays every seat to the end.
    await room.request("setAutoplay", { on: true });
    await runBots(() => room.game.over);
    expect(await room.request("rematch", {})).toEqual({ ok: true });
    const next = restore(room.state.rematchRoomId!)!;
    expect(viewOf(next).seats.map((s) => s.name)).toEqual(["Maija", "Kettu", "Ilves"]);
    expect(next.game.moves).toBe(0);
  });
});

describe("device-games › Undo against bots", () => {
  it("Undo after the bots moved: the board is as before the player's move and they are on turn", async () => {
    vi.useFakeTimers();
    const room = create(2);
    const before = room.game.cells;
    await playFree(room);
    await runBots(() => room.game.turn === 1);
    expect(room.game.moves).toBe(3);
    expect(viewOf(room).undoable).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: true });
    expect(room.game.cells).toEqual(before);
    expect(viewOf(room)).toMatchObject({ undoable: false, isMyTurn: true });
    expect(loadLocalGame(room.roomId)?.game.moves).toBe(0);
  });

  it("Nothing to undo before the first move; repeated undo goes back move by move", async () => {
    vi.useFakeTimers();
    const room = create(1);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    await playFree(room);
    await runBots(() => room.game.turn === 1);
    await playFree(room);
    await runBots(() => room.game.turn === 1);
    expect(room.game.moves).toBe(4);
    await room.request("undo", {});
    expect(room.game.moves).toBe(2);
    await room.request("undo", {});
    expect(room.game.moves).toBe(0);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("an answer that arrives after an undo is dropped", async () => {
    vi.useFakeTimers();
    const asked: ((move: number | undefined) => void)[] = [];
    const room = create(1, { askBot: () => new Promise((resolve) => asked.push(resolve)) });
    await playFree(room);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    await room.request("undo", {});
    asked[0]!(4);
    await vi.advanceTimersByTimeAsync(0);
    expect([room.game.moves, room.game.turn]).toEqual([0, 1]);
  });
});

describe("bot-seats › Bot plays a person's seat (on the device)", () => {
  it("the bot plays the player's turns until they take back; their own command is refused meanwhile", async () => {
    vi.useFakeTimers();
    const room = create(1);
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    expect(viewOf(room)).toMatchObject({ myAutoplay: true, isMyTurn: false, turnAutoplay: true });
    expect(await playFree(room)).toEqual({ ok: false, code: "AUTOPLAYING" });
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(2 * BOT_DELAY_MS);
    expect(room.game.moves).toBeGreaterThanOrEqual(3);

    expect(await room.request("setAutoplay", { on: false })).toEqual({ ok: true });
    await runBots(() => room.game.turn === 1);
    const { moves } = room.game;
    await vi.advanceTimersByTimeAsync(10 * BOT_DELAY_MS);
    expect([room.game.moves, room.game.turn]).toEqual([moves, 1]);
  });
});

describe("device-games › Watching bots on the device", () => {
  it("Bots only: the viewer is a spectator; they play to the end; no undo", async () => {
    vi.useFakeTimers();
    const room = createWatch(2);
    expect(viewOf(room)).toMatchObject({ spectating: true, botOnly: true, canUndo: false });
    expect(viewOf(room).seats.map((s) => s.name)).toEqual(["Kettu", "Ilves"]);
    await runBots(() => room.game.over);
    expect(room.game.over).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("Faster bots: 4× shrinks the pause; the spectator cannot play", async () => {
    vi.useFakeTimers();
    const room = createWatch(2);
    expect(await room.request("setSpeed", { speed: 4 })).toEqual({ ok: true });
    expect(viewOf(room).botSpeed).toBe(4);
    // The pause already running keeps its length; the next ones are a quarter.
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    const { moves } = room.game;
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS / 4);
    expect(room.game.moves).toBe(moves + 1);
    expect(await playFree(room)).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("never saved: the quick game slot is left alone", () => {
    const game = create(1, quiet);
    createWatch(2, quiet);
    expect(loadLocalGame(game.roomId)).toBeDefined();
  });
});

describe("game-session › Resume after closing the app (on the device)", () => {
  it("Bot game on the device the next day: offered without the time limit", () => {
    saveResume("local:local-abc", "local-abc", 0);
    expect(loadResume(24 * 3600_000)).toMatchObject({ roomId: "local-abc" });
  });

  it("the connector restores a saved game by token and by id, and refuses a gone one like a gone room", async () => {
    const room = create(1, quiet);
    const connector = createConnector(connectFour);
    expect((await connector.reconnect(room.reconnectionToken)).roomId).toBe(room.roomId);
    expect((await connector.joinById(room.roomId, { nickname: "Maija" })).roomId).toBe(room.roomId);
    await room.leave();
    await expect(connector.reconnect(room.reconnectionToken)).rejects.toMatchObject({ code: 524 });
  });

  it("Offline: a bot game starts through the connector without any network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const room = await createConnector(connectFour).createBotGame({ nickname: "Maija", bots: 1 });
    expect(room.roomId).toMatch(/^local-/);
    expect(fetchSpy).not.toHaveBeenCalled();
    await room.leave();
  });
});
