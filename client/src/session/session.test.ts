// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { CLASSIC, legalMoves, type Placement } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameSession, type Connector, type GameRoomLike } from "./useGameSession.ts";
import { toGameView, type SyncedState } from "./viewModel.ts";

/** Colour 1 has the single square and the domino in its corner, colour 2 the single square in its own. */
const started = positionWith(
  [
    [1, placement("I1", ["#"], 0, 0)],
    [2, placement("I1", ["#"], 0, 19)],
    [1, placement("I2", ["#", "#"], 1, 1)],
  ],
  [1, 2],
);
const board = started.cells;
const colours = [
  { colour: 1, pieces: [0, 1], out: false, left: false },
  { colour: 2, pieces: [0], out: true, left: false },
];

function syncedState(players: Record<string, number>, turn: Partial<SyncedState> = {}): SyncedState {
  return {
    turnSeat: 1,
    phase: "play",
    ...turn,
    game: { cells: board, colours },
    players: new Map(Object.entries(players).map(([id, seat]) => [id, { seat, connected: true }])),
  };
}

const MOVE: Placement = { piece: 4, orientation: 0, row: 2, col: 3 };

function fakeRoom(overrides: Partial<GameRoomLike> = {}): GameRoomLike {
  return {
    roomId: "brave-otters-sing",
    sessionId: "me",
    reconnectionToken: "brave-otters-sing:token",
    state: syncedState({ me: 1, other: 2 }),
    onStateChange: vi.fn(),
    onLeave: vi.fn(),
    onDrop: vi.fn(),
    onReconnect: vi.fn(),
    request: vi.fn(async () => ({ ok: true })),
    leave: vi.fn(async () => 1000),
    removeAllListeners: vi.fn(),
    ...overrides,
  };
}

function connectorWith(overrides: Partial<Connector>): Connector {
  return {
    create: vi.fn(),
    createBotGame: vi.fn(),
    joinById: vi.fn(),
    watch: vi.fn(),
    createBotWatch: vi.fn(),
    reconnect: vi.fn(),
    ...overrides,
  };
}

async function playingWith(room: GameRoomLike) {
  const connector = connectorWith({ create: vi.fn(async () => room) });
  const hook = renderHook(() => useGameSession(connector));
  act(() => hook.result.current.createGame("Maija"));
  await waitFor(() => expect(hook.result.current.status).toBe("playing"));
  return hook;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("game-session › view model", () => {
  it("takes the synced board, lists seats in order and scores them by the rules", () => {
    const view = toGameView(syncedState({ b: 2, me: 1 }), "r", "me")!;
    expect(view.board).toEqual(board);
    expect(view.seats.map((s) => [s.seat, s.isMe, s.score, s.squares, s.out])).toEqual([
      [1, true, 3 - 89, 3, false],
      [2, false, 1 - 89, 1, true],
    ]);
    expect(view.mySeat).toBe(1);
  });

  it("rebuilds the rules' position, so the viewer's legal moves are the server's", () => {
    const { position } = toGameView(syncedState({ me: 1, b: 2 }), "r", "me")!;
    expect(position).toMatchObject({ config: CLASSIC, colours: [1, 2], out: [2], turn: 1, moveNumber: 3, ended: false });
    expect(legalMoves(position!, 1)).toEqual(legalMoves({ ...started, out: [2] }, 1));
    expect(toGameView({ ...syncedState({ me: 1 }), game: { cells: board, colours: [] } }, "r", "me")!.position).toBeUndefined();
  });

  it("returns undefined until the board has arrived", () => {
    expect(toGameView({ game: { cells: [] }, players: new Map() }, "r", "me")).toBeUndefined();
    // Right after joining, before the first patch, the decoded state is still empty.
    expect(toGameView({}, "r", "me")).toBeUndefined();
  });
});

describe("game-session › place command", () => {
  async function playing(room: GameRoomLike) {
    const connector = connectorWith({ create: vi.fn(async () => room), reconnect: vi.fn() });
    const hook = renderHook(() => useGameSession(connector));
    act(() => hook.result.current.createGame("Maija"));
    await waitFor(() => expect(hook.result.current.status).toBe("playing"));
    return hook;
  }

  it("accepted: sends the move and shows no notice", async () => {
    const room = fakeRoom();
    const { result } = await playing(room);
    let reply: unknown;
    await act(async () => {
      reply = await result.current.place(MOVE);
    });
    expect(reply).toEqual({ ok: true });
    expect(room.request).toHaveBeenCalledWith("move", { move: MOVE });
    expect(result.current.notice).toBeUndefined();
    expect(result.current.pending).toBe(false);
  });
});

describe("game-session › end of the game in the view model", () => {
  it("finished: the rules' position has ended", () => {
    const view = toGameView(syncedState({ me: 1, b: 2 }, { phase: "finished", winners: [1, 2] }), "r", "me")!;
    expect(view.position).toMatchObject({ ended: true, turn: 0, aborted: false });
  });
});

describe("game-session › Palikka's commands", () => {
  it("setVariant sends the options; a quick bot game passes its variant as the options", async () => {
    const room = fakeRoom();
    const createBotGame = vi.fn(async () => room);
    const { result } = await playingWith(room);
    await act(async () => {
      await result.current.setVariant("duo");
    });
    expect(room.request).toHaveBeenCalledWith("setOptions", { options: { variant: "duo" } });
    sessionStorage.clear();
    const hook = renderHook(() => useGameSession(connectorWith({ createBotGame })));
    act(() => hook.result.current.playBots("Maija", 2, "trio"));
    await waitFor(() => expect(createBotGame).toHaveBeenCalledWith({ nickname: "Maija", bots: 2, options: { variant: "trio" } }));
  });
});
