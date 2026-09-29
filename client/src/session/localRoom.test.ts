// @vitest-environment jsdom
import { createRng, decodeMove, legalMoves, simpleBotMove, type Placement } from "@palikka/rules";
import { placement } from "@palikka/rules/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AskBot, MoveRequest } from "../bots/botMoves.ts";
import { loadLocalGame } from "./localGameStore.ts";
import { BOT_DELAY_MS, LocalRoom } from "./localRoom.ts";
import { loadResume, saveResume } from "./resumeRecord.ts";
import { createConnector } from "./useGameSession.ts";
import { toGameView } from "./viewModel.ts";

/** A quick stand-in for the bot worker: the simple bot, answered at once. */
const simpleBot: AskBot = async ({ position, colour, seed }) => simpleBotMove(position, colour, createRng(seed));
const quiet = { setTimeout: () => 0, clearTimeout: () => {}, askBot: simpleBot };

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

/** A new game with bot timers switched off (Maija in seat 1 has the first turn). */
function quietGame(bots = 1) {
  return LocalRoom.create("Maija", bots, { seed: () => 7, ...quiet });
}

/** A game with real (fake-timer) bot pauses. */
function timedGame(bots = 1, askBot: AskBot = simpleBot) {
  return LocalRoom.create("Maija", bots, { seed: () => 7, askBot });
}

const viewOf = (room: LocalRoom) => toGameView(room.state, room.roomId, room.sessionId)!;
/** The first legal move of `colour` in the room's game. */
const firstMove = (room: LocalRoom, colour = 1): Placement => decodeMove(legalMoves(room.game.position, colour)[0]!, 20);
/** Maija makes a legal move. */
const placeFree = (room: LocalRoom) => room.request("place", firstMove(room));
/** Lets bot pauses run out (and their answers arrive) until `done`, at most `max` pauses. */
async function runBots(done: () => boolean, max = 200) {
  for (let i = 0; i < max && !done(); i++) await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
}

describe("device-games › Game against bots on the device", () => {
  it("One against three: Maija and the forest animals, Maija's colour 1 on turn with no clock", () => {
    const view = viewOf(quietGame(3));
    expect(view.seats.map((s) => [s.seat, s.name, s.isBot])).toEqual([
      [1, "Maija", false],
      [2, "Kettu", true],
      [3, "Ilves", true],
      [4, "Pöllö", true],
    ]);
    expect(view).toMatchObject({ phase: "playing", isMyTurn: true, turnSeat: 1, turnDeadline: 0, canKick: false, canUndo: true, undoable: false });
    expect(view.position?.colours).toEqual([1, 2, 3, 4]);
  });

  it("commands answer like the server, with the rules' refusals, and every step is saved", async () => {
    const room = quietGame();
    expect(await room.request("place", placement("I1", ["#"], 5, 5))).toEqual({ ok: false, code: "NOT_ON_START" });
    expect(await room.request("place", { row: 0, col: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(await placeFree(room)).toEqual({ ok: true });
    expect(await room.request("place", firstMove(room, 1))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
    expect(await room.request("kick", { seat: 2 })).toEqual({ ok: false, code: "WRONG_PHASE" });
    expect(loadLocalGame(room.roomId)?.game.position.cells[0]).toBe(1);
  });

  it("Bot answers: after the pause the bot moves and Maija is on turn again; the game plays to its end", async () => {
    vi.useFakeTimers();
    const room = timedGame(2);
    await placeFree(room);
    expect(room.game.position.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 1);
    expect(room.game.position.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(room.game.position.turn).toBe(3);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.position.turn).toBe(1);
    for (let i = 0; i < 500 && !room.game.position.ended; i++) {
      if (room.game.position.turn === 1) await placeFree(room);
      else await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    }
    expect(room.game.position.ended).toBe(true);
    expect(viewOf(room).winners.length).toBeGreaterThan(0);
    expect(viewOf(room).finished).toBe(true);
  });

  it("the default bot answers here where no worker can run (tests, old browsers)", async () => {
    // The search bot's time limit reads the real clock: only the pause is faked.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const room = LocalRoom.create("Maija", 1, { seed: () => 7 });
    await placeFree(room);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.position.placed[2]).toHaveLength(1);
  });

  it("Pause not stretched: the bot thinks during the pause, and a slow answer lands when it arrives", async () => {
    vi.useFakeTimers();
    const asked: { at: number; resolve(move: Placement | undefined): void; request: MoveRequest }[] = [];
    const room = timedGame(1, (request) => new Promise((resolve) => asked.push({ at: Date.now(), resolve, request })));
    const start = Date.now();
    await placeFree(room);
    // Asked at once, not after the pause.
    expect(asked).toHaveLength(1);
    expect(asked[0]!.at).toBe(start);
    expect(asked[0]!.request.budget).toEqual({ timeMs: 800 });
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.position.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS / 2);
    const { position, colour, seed } = asked[0]!.request;
    asked[0]!.resolve(simpleBotMove(position, colour, createRng(seed)));
    await vi.advanceTimersByTimeAsync(0);
    expect(room.game.position.turn).toBe(1);
  });

  it("a refused bot move falls back to the simple bot", async () => {
    vi.useFakeTimers();
    const room = timedGame(1, async () => placement("I1", ["#"], 5, 5));
    await placeFree(room);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.position.placed[2]).toHaveLength(1);
    expect(room.game.position.turn).toBe(1);
  });

  it("a restored game continues where it was", async () => {
    const room = quietGame();
    await placeFree(room);
    room.removeAllListeners();
    const restored = LocalRoom.restore(room.roomId, quiet)!;
    expect(restored.game.position.turn).toBe(2);
    expect(viewOf(restored).seats[0]!.score).toBe(1 - 89);
  });

  it("Old save: a saved game of the placeholder format is dropped, not offered", () => {
    localStorage.setItem("palikka.localGame", JSON.stringify({ roomId: "local-old", game: { seed: 1, board: [0, 0], seats: [], step: "play" } }));
    expect(LocalRoom.restore("local-old", quiet)).toBeUndefined();
    expect(localStorage.getItem("palikka.localGame")).toBeNull();
  });

  it("Leaving a quick bot game: the game is gone", async () => {
    const room = quietGame();
    await room.leave();
    expect(loadLocalGame(room.roomId)).toBeUndefined();
  });

  it("Quick bot game again: a finished game's rematch is a new saved game with the same bots", async () => {
    vi.useFakeTimers();
    const room = timedGame(2);
    expect(await room.request("rematch", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    // The bot plays every seat to the end.
    await room.request("setAutoplay", { on: true });
    await runBots(() => room.game.position.ended);
    expect(room.game.position.ended).toBe(true);
    expect(await room.request("rematch", {})).toEqual({ ok: true });
    const next = LocalRoom.restore(room.state.rematchRoomId!, quiet)!;
    expect(next.game.seats.map((s) => s.name)).toEqual(["Maija", "Kettu", "Ilves"]);
    expect(next.game.position.moveNumber).toBe(0);
  });
});

describe("device-games › Undo against bots", () => {
  it("Undo after the bots moved: the board is as before Maija's move and she is on turn", async () => {
    vi.useFakeTimers();
    const room = timedGame(2);
    const before = room.game.position.cells;
    await placeFree(room);
    await runBots(() => room.game.position.turn === 1);
    expect(room.game.position.moveNumber).toBe(3);
    expect(viewOf(room).undoable).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: true });
    expect(room.game.position.cells).toEqual(before);
    expect(room.game.position.turn).toBe(1);
    expect(viewOf(room)).toMatchObject({ undoable: false, isMyTurn: true });
    expect(loadLocalGame(room.roomId)?.game.position.moveNumber).toBe(0);
  });

  it("Nothing to undo before the first move; repeated undo goes back move by move", async () => {
    vi.useFakeTimers();
    const room = timedGame(1);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
    await placeFree(room);
    await runBots(() => room.game.position.turn === 1);
    await placeFree(room);
    await runBots(() => room.game.position.turn === 1);
    expect(room.game.position.moveNumber).toBe(4);
    await room.request("undo", {});
    expect(room.game.position.moveNumber).toBe(2);
    await room.request("undo", {});
    expect(room.game.position.moveNumber).toBe(0);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "WRONG_PHASE" });
  });

  it("an answer that arrives after an undo is dropped", async () => {
    vi.useFakeTimers();
    const asked: { request: MoveRequest; resolve(move: Placement | undefined): void }[] = [];
    const room = timedGame(1, (request) => new Promise((resolve) => asked.push({ request, resolve })));
    await placeFree(room);
    expect(asked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    await room.request("undo", {});
    const { position, colour, seed } = asked[0]!.request;
    asked[0]!.resolve(simpleBotMove(position, colour, createRng(seed)));
    await vi.advanceTimersByTimeAsync(0);
    expect(room.game.position.moveNumber).toBe(0);
    expect(room.game.position.turn).toBe(1);
  });
});

describe("bot-seats › Bot plays a person's seat (on the device)", () => {
  it("the bot plays Maija's turns until she takes back; her own command is refused meanwhile", async () => {
    vi.useFakeTimers();
    const room = timedGame();
    expect(await room.request("setAutoplay", { on: true })).toEqual({ ok: true });
    expect(viewOf(room)).toMatchObject({ myAutoplay: true, isMyTurn: false, turnAutoplay: true });
    expect(await placeFree(room)).toEqual({ ok: false, code: "AUTOPLAYING" });
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    expect(room.game.position.turn).toBe(2);
    await vi.advanceTimersByTimeAsync(2 * BOT_DELAY_MS);
    expect(room.game.position.moveNumber).toBeGreaterThanOrEqual(3);

    expect(await room.request("setAutoplay", { on: false })).toEqual({ ok: true });
    await runBots(() => room.game.position.turn === 1);
    const { moveNumber } = room.game.position;
    await vi.advanceTimersByTimeAsync(10 * BOT_DELAY_MS);
    expect(room.game.position).toMatchObject({ moveNumber, turn: 1 });
  });
});

describe("device-games › Watching bots on the device", () => {
  it("Four bots: the viewer is a spectator; they play until no colour can move; no undo", async () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(4, 1, { seed: () => 7, askBot: simpleBot });
    const view = viewOf(room);
    expect(view).toMatchObject({ spectating: true, botOnly: true, canUndo: false });
    expect(view.seats.map((s) => s.name)).toEqual(["Kettu", "Ilves", "Pöllö", "Näätä"]);
    await runBots(() => room.game.position.ended, 400);
    expect(room.game.position.ended).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("Faster bots: 4× shrinks the pause; the spectator cannot play", async () => {
    vi.useFakeTimers();
    const room = LocalRoom.createWatch(2, 1, { seed: () => 7, askBot: simpleBot });
    expect(await room.request("setSpeed", { speed: 4 })).toEqual({ ok: true });
    expect(viewOf(room).botSpeed).toBe(4);
    // The pause already running keeps its length; the next ones are a quarter.
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    const { moveNumber } = room.game.position;
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS / 4);
    expect(room.game.position.moveNumber).toBe(moveNumber + 1);
    expect(await placeFree(room)).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("never saved: the quick game slot is left alone", async () => {
    const game = quietGame();
    LocalRoom.createWatch(2, 1, quiet);
    expect(loadLocalGame(game.roomId)).toBeDefined();
  });
});

describe("game-session › Resume after closing the app (on the device)", () => {
  it("Bot game on the device the next day: offered without the time limit", () => {
    saveResume("local:local-abc", "local-abc", 0);
    expect(loadResume(24 * 3600_000)).toMatchObject({ roomId: "local-abc" });
  });

  it("the connector restores a saved game by token and by id, and refuses a gone one like a gone room", async () => {
    const room = quietGame();
    const connector = createConnector();
    const byToken = await connector.reconnect(room.reconnectionToken);
    expect(byToken.roomId).toBe(room.roomId);
    expect((await connector.joinById(room.roomId, { nickname: "Maija" })).roomId).toBe(room.roomId);
    await room.leave();
    await expect(connector.reconnect(room.reconnectionToken)).rejects.toMatchObject({ code: 524 });
  });

  it("Offline: a bot game starts through the connector without any network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const room = await createConnector().createBotGame({ nickname: "Maija", bots: 1 });
    expect(room.roomId).toMatch(/^local-/);
    expect(fetchSpy).not.toHaveBeenCalled();
    await room.leave();
  });
});
