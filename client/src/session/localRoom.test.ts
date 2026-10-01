// @vitest-environment jsdom
import { createRng, decodeMove, legalMoves, simpleBotMove, type Game, type PalikkaOptions, type Placement, type VariantId } from "@palikka/rules";
import { placement } from "@palikka/rules/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AskBot, MoveRequest } from "../bots/botMoves.ts";
import { BOT_DELAY_MS, LocalRoom, loadLocalGame as loadSaved, loadResume, saveResume, type LocalRoomDeps } from "@game-kit/client";
import { createPalikkaClient, palikkaClient } from "./palikkaClient.ts";
import { createConnector } from "./useGameSession.ts";
import { toGameView, type GameView, type SyncedState } from "./viewModel.ts";

type Room = LocalRoom<Game, Placement, PalikkaOptions, GameView>;
type Deps = Partial<LocalRoomDeps> & { askBot?: AskBot };

/** Palikka's device game, with `askBot` standing in for the bot worker. */
const LocalGame = {
  create: (nickname: string, bots: number, { askBot = simpleBot, ...deps }: Deps = {}, variant?: VariantId): Room =>
    LocalRoom.create(createPalikkaClient(askBot), nickname, bots, variant && { variant }, deps),
  createWatch: (bots: number, speed: 1 | 2 | 4 = 1, { askBot = simpleBot, ...deps }: Deps = {}, variant?: VariantId): Room =>
    LocalRoom.createWatch(createPalikkaClient(askBot), bots, speed, variant && { variant }, deps),
  restore: (roomId: string, { askBot = simpleBot, ...deps }: Deps = {}): Room | undefined => LocalRoom.restore(createPalikkaClient(askBot), roomId, deps),
};
const loadLocalGame = (roomId: string) => loadSaved<Game, PalikkaOptions>(roomId, palikkaClient.local.save);

/** A quick stand-in for the bot worker: the simple bot, answered at once. */
const simpleBot: AskBot = async ({ position, colour, seed }) => simpleBotMove(position, colour, createRng(seed));
const quiet = { setTimeout: () => 0, clearTimeout: () => {}, askBot: simpleBot };

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

/** A new game with bot timers switched off (Maija in seat 1 has the first turn). */
function quietGame(bots = 1) {
  return LocalGame.create("Maija", bots, { seed: () => 7, ...quiet });
}

/** A game with real (fake-timer) bot pauses. */
function timedGame(bots = 1, askBot: AskBot = simpleBot) {
  return LocalGame.create("Maija", bots, { seed: () => 7, askBot });
}

const viewOf = (room: Room) => toGameView(room.state as SyncedState, room.roomId, room.sessionId)!;
/** The first legal move of `colour` in the room's game. */
const firstMove = (room: Room, colour = 1): Placement => decodeMove(legalMoves(room.game.position, colour)[0]!, room.game.position.config.size);
/** Maija makes a legal move. */
const placeFree = (room: Room) => room.request("move", { move: firstMove(room) });
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
    expect(await room.request("move", { move: placement("I1", ["#"], 5, 5) })).toEqual({ ok: false, code: "NOT_ON_START" });
    expect(await room.request("move", { move: { row: 0, col: 0 } })).toEqual({ ok: false, code: "INVALID_COMMAND" });
    expect(await placeFree(room)).toEqual({ ok: true });
    expect(await room.request("move", { move: firstMove(room, 1) })).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
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
    const room = LocalGame.create("Maija", 1, { seed: () => 7 });
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
    const restored = LocalGame.restore(room.roomId, quiet)!;
    expect(restored.game.position.turn).toBe(2);
    expect(viewOf(restored).seats[0]!.score).toBe(1 - 89);
  });

  it("Old save: a saved game of the placeholder format is dropped, not offered", () => {
    localStorage.setItem("palikka.localGame", JSON.stringify({ roomId: "local-old", game: { seed: 1, board: [0, 0], seats: [], step: "play" } }));
    expect(LocalGame.restore("local-old", quiet)).toBeUndefined();
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
    const next = LocalGame.restore(room.state.rematchRoomId!, quiet)!;
    expect(next.game.seats.map((s) => s.name)).toEqual(["Maija", "Kettu", "Ilves"]);
    expect(next.game.position.moveNumber).toBe(0);
  });
});

describe("device-games › Variants on the device", () => {
  it("Tuplaväri on the device: Maija plays colours 1 and 3, Kettu 2 and 4, colour 1 on turn", () => {
    const room = LocalGame.create("Maija", 1, { seed: () => 7, ...quiet }, "double");
    const view = viewOf(room);
    expect(view.seats.map((s) => [s.name, s.colours])).toEqual([
      ["Maija", [1, 3]],
      ["Kettu", [2, 4]],
    ]);
    expect(view).toMatchObject({ variant: "double", turnColour: 1, isMyTurn: true, trayColour: 1 });
    expect(loadLocalGame(room.roomId)?.game.variant).toBe("double");
  });

  it("Undo in Tuplaväri: back to before the colour-3 move, colour 3 on turn again", async () => {
    vi.useFakeTimers();
    const room = LocalGame.create("Maija", 1, { seed: () => 7, askBot: simpleBot }, "double");
    await placeFree(room);
    await runBots(() => room.game.position.turn === 3);
    expect(viewOf(room)).toMatchObject({ turnColour: 3, isMyTurn: true, trayColour: 3 });
    expect(await room.request("move", { move: firstMove(room, 3) })).toEqual({ ok: true });
    await runBots(() => room.game.position.turn === 1);
    expect(room.game.position.placed[4]).toHaveLength(1);
    expect(await room.request("undo", {})).toEqual({ ok: true });
    expect(room.game.position.turn).toBe(3);
    expect(room.game.position.placed[3]).toHaveLength(0);
    expect(room.game.position.placed[4]).toHaveLength(0);
  });

  it("Kolmikko with two bots runs to the end; the shared colour is asked for its player's side", async () => {
    vi.useFakeTimers();
    const asked: MoveRequest[] = [];
    const askBot: AskBot = async (request) => {
      asked.push(request);
      return simpleBot(request);
    };
    const room = LocalGame.create("Maija", 2, { seed: () => 7, askBot }, "trio");
    expect(viewOf(room).seats.map((s) => s.name)).toEqual(["Maija", "Kettu", "Ilves"]);
    await room.request("setAutoplay", { on: true });
    await runBots(() => room.game.position.ended, 400);
    expect(room.game.position.ended).toBe(true);
    expect(room.game.position.placed[4]!.length).toBeGreaterThan(0);
    const shared = asked.filter((r) => r.colour === 4);
    expect(shared.map((r) => r.viewpoint)).toEqual(shared.map((_, i) => [1, 2, 3][i % 3]));
    const view = viewOf(room);
    expect(view.results.at(-1)).toMatchObject({ shared: true, colours: [4], rank: 0 });
    expect(view.winners.length).toBeGreaterThan(0);
  });

  it("Duo bots: two bots play on the 14×14 board; a rematch keeps the variant", async () => {
    vi.useFakeTimers();
    const watch = LocalGame.createWatch(4, 1, { seed: () => 7, askBot: simpleBot }, "duo");
    expect(viewOf(watch)).toMatchObject({ variant: "duo", boardSize: 14 });
    expect(viewOf(watch).seats).toHaveLength(2);
    await runBots(() => watch.game.position.ended, 200);
    expect(watch.game.position.ended).toBe(true);
    const room = LocalGame.create("Maija", 3, { seed: () => 7, askBot: simpleBot }, "duo");
    expect(room.game.seats).toHaveLength(2);
    await room.request("setAutoplay", { on: true });
    await runBots(() => room.game.position.ended, 200);
    expect(await room.request("rematch", {})).toEqual({ ok: true });
    expect(LocalGame.restore(room.state.rematchRoomId!, quiet)!.game.variant).toBe("duo");
  });

  it("Old save: a game saved before the variants is dropped", () => {
    const room = quietGame();
    const saved = JSON.parse(localStorage.getItem("palikka.localGame")!);
    delete saved.game.variant;
    delete saved.game.control;
    localStorage.setItem("palikka.localGame", JSON.stringify(saved));
    expect(LocalGame.restore(room.roomId, quiet)).toBeUndefined();
  });

  it("Old save: a game saved before the game kit (no envelope version) is dropped once", () => {
    const room = quietGame();
    const { version, seats, options, ...before } = JSON.parse(localStorage.getItem("palikka.localGame")!);
    expect([version, seats.length, options]).toEqual([2, 2, { variant: "classic" }]);
    localStorage.setItem("palikka.localGame", JSON.stringify({ ...before, history: [] }));
    expect(LocalGame.restore(room.roomId, quiet)).toBeUndefined();
    expect(localStorage.getItem("palikka.localGame")).toBeNull();
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
    const room = LocalGame.createWatch(4, 1, { seed: () => 7, askBot: simpleBot });
    const view = viewOf(room);
    expect(view).toMatchObject({ spectating: true, botOnly: true, canUndo: false });
    expect(view.seats.map((s) => s.name)).toEqual(["Kettu", "Ilves", "Pöllö", "Näätä"]);
    await runBots(() => room.game.position.ended, 400);
    expect(room.game.position.ended).toBe(true);
    expect(await room.request("undo", {})).toEqual({ ok: false, code: "NOT_SEATED" });
  });

  it("Faster bots: 4× shrinks the pause; the spectator cannot play", async () => {
    vi.useFakeTimers();
    const room = LocalGame.createWatch(2, 1, { seed: () => 7, askBot: simpleBot });
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
    LocalGame.createWatch(2, 1, quiet);
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
