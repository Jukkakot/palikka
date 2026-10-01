// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { CLOSE_CODES } from "@game-kit/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toLobbyView, type SyncedLobbyState } from "../src/session/lobbyView.ts";
import { loadNickname } from "../src/session/nickname.ts";
import { loadResume, saveResume } from "../src/session/resumeRecord.ts";
import type { GameRoomLike } from "../src/session/roomLike.ts";
import { loadToken, saveToken } from "../src/session/sessionToken.ts";
import { useKitSession, type Connector } from "../src/session/useKitSession.ts";
import { connectFour, ERROR_CODES, syncedState } from "./support/connectFour.ts";

/** The kit's session with the test game. */
const useSession = (connector?: Connector) => useKitSession({ definition: connectFour, errorCodes: ERROR_CODES, connector });

const MOVE = 3;

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

/** A room whose onLeave callback the test can fire. */
function leavableRoom() {
  let fire: (code: number) => void = () => {};
  const room = fakeRoom({ onLeave: vi.fn((cb: (code: number) => void) => (fire = cb)) });
  return { room, fireLeave: (code: number) => fire(code) };
}

async function playingWith(room: GameRoomLike) {
  const connector = connectorWith({ create: vi.fn(async () => room) });
  const hook = renderHook(() => useSession(connector));
  act(() => hook.result.current.createGame("Maija"));
  await waitFor(() => expect(hook.result.current.status).toBe("playing"));
  return hook;
}

/** An SDK matchmaking error. */
const matchMakeError = (message: string, code: number) => Object.assign(new Error(message), { code });

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("game-session › lobby view", () => {
  it("knows the bot runner and whether the turn is a bot's", () => {
    const state = syncedState({ me: 1 }, { turnSeat: 2, botRunnerSeat: 1 });
    (state.players as Map<string, object>).set("bot:2", { seat: 2, connected: true, bot: true });
    expect(toLobbyView(state, "r", "me")).toMatchObject({ botRunnerSeat: 1, turnBotPlayed: true, canUndo: false });
  });

  it("derives whose turn it is", () => {
    expect(toLobbyView(syncedState({ me: 1, b: 2 }), "r", "me")).toMatchObject({ turnSeat: 1, isMyTurn: true });
    expect(toLobbyView(syncedState({ me: 1, b: 2 }, { turnSeat: 2 }), "r", "me")).toMatchObject({ turnSeat: 2, isMyTurn: false });
  });

  it("marks bots, which always count as connected", () => {
    const state = syncedState({ me: 1 });
    state.players = new Map([
      ["me", { seat: 1, connected: true }],
      ["bot:2", { seat: 2, connected: false, bot: true, name: "Robo" }],
    ]);
    expect(toLobbyView(state, "r", "me")!.seats.map((s) => [s.seat, s.isBot, s.connected])).toEqual([
      [1, false, true],
      [2, true, true],
    ]);
  });
});

describe("game-session › commands", () => {
  async function playing(room: GameRoomLike) {
    const connector = connectorWith({ create: vi.fn(async () => room), reconnect: vi.fn() });
    const hook = renderHook(() => useSession(connector));
    act(() => hook.result.current.createGame("Maija"));
    await waitFor(() => expect(hook.result.current.status).toBe("playing"));
    return hook;
  }

  it("rejected: notice key for the code, cleared after 4 s", async () => {
    const room = fakeRoom({ request: vi.fn(async () => ({ ok: false, code: "COLUMN_FULL" })) });
    const { result } = await playing(room);
    vi.useFakeTimers();
    try {
      await act(async () => {
        await result.current.command("move", { move: MOVE });
      });
      expect(result.current.notice).toBe("errors.COLUMN_FULL");
      act(() => vi.advanceTimersByTime(4_000));
      expect(result.current.notice).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unknown codes and lost replies fall back to the generic message", async () => {
    const room = fakeRoom({ request: vi.fn(async () => Promise.reject(new Error("closed"))) });
    const { result } = await playing(room);
    await act(async () => {
      await result.current.command("move", { move: MOVE });
    });
    expect(result.current.notice).toBe("errors.generic");
  });

  it("pending blocks a second command", async () => {
    let resolve!: (r: unknown) => void;
    const room = fakeRoom({ request: vi.fn(() => new Promise((r) => (resolve = r))) });
    const { result } = await playing(room);

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.command("move", { move: MOVE });
    });
    expect(result.current.pending).toBe(true);
    let second: unknown = "not called";
    await act(async () => {
      second = await result.current.command("move", { move: 5 });
    });
    expect(second).toBeUndefined();
    expect(room.request).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true });
      await first;
    });
    expect(result.current.pending).toBe(false);
  });
});

describe("game-session › One player per browser tab", () => {
  it("stores the reconnection token on join", async () => {
    const connector = connectorWith({ create: vi.fn(async () => fakeRoom()), reconnect: vi.fn() });
    const { result } = renderHook(() => useSession(connector));
    expect(result.current.status).toBe("idle");

    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(loadToken()).toBe("brave-otters-sing:token");
    expect(result.current.view?.roomId).toBe("brave-otters-sing");
  });

  it("Reload keeps the seat: a stored token rejoins without Play", async () => {
    saveToken("old-token");
    const connector = connectorWith({ create: vi.fn(), reconnect: vi.fn(async () => fakeRoom()) });
    const { result } = renderHook(() => useSession(connector));
    expect(result.current.status).toBe("connecting");
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.reconnect).toHaveBeenCalledWith("old-token");
    expect(connector.create).not.toHaveBeenCalled();
  });

  it("a failed rejoin clears the token and shows the start screen", async () => {
    saveToken("stale");
    const connector = connectorWith({ create: vi.fn(), reconnect: vi.fn(async () => Promise.reject(new Error("gone"))) });
    const { result } = renderHook(() => useSession(connector));
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(loadToken()).toBeUndefined();
  });
});

describe("game-session › Quick play", () => {
  it("Join fails: error state", async () => {
    const connector = connectorWith({ create: vi.fn(async () => Promise.reject(new Error("offline"))), reconnect: vi.fn() });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("Slow server: flags a slow connection after 5 s", async () => {
    vi.useFakeTimers();
    try {
      const connector = connectorWith({ create: vi.fn(() => new Promise<GameRoomLike>(() => {})), reconnect: vi.fn() });
      const { result } = renderHook(() => useSession(connector));
      act(() => result.current.createGame("Maija"));
      expect(result.current.slow).toBe(false);
      act(() => vi.advanceTimersByTime(5_000));
      expect(result.current.status).toBe("connecting");
      expect(result.current.slow).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("game-session › quick-play pool", () => {
  it("reads ?pool= and ignores an empty value", async () => {
    const { quickPlayPool } = await import("../src/session/useKitSession.ts");
    expect(quickPlayPool("?pool=e2e-123")).toBe("e2e-123");
    expect(quickPlayPool("?pool=")).toBeUndefined();
    expect(quickPlayPool("")).toBeUndefined();
  });
});

describe("game-session › bot commands", () => {
  it("addBot and removeBot send the seat; a rejection gives its notice", async () => {
    const room = fakeRoom({ request: vi.fn(async (type: string) => (type === "addBot" ? { ok: true } : { ok: false, code: "NOT_A_BOT" })) });
    const { result } = await playingWith(room);
    await act(async () => {
      await result.current.addBot(3);
    });
    expect(room.request).toHaveBeenCalledWith("addBot", { seat: 3 });
    expect(result.current.notice).toBeUndefined();
    await act(async () => {
      await result.current.removeBot(2);
    });
    expect(room.request).toHaveBeenCalledWith("removeBot", { seat: 2 });
    expect(result.current.notice).toBe("errors.NOT_A_BOT");
  });
});

describe("game-session › end of the game in the view model", () => {
  it("finished: winner known, nobody's turn", () => {
    const view = toLobbyView(syncedState({ me: 1, b: 2 }, { phase: "finished", winners: [1, 2] }), "r", "me")!;
    expect(view).toMatchObject({ finished: true, winners: [1, 2], isMyTurn: false });
  });
});

describe("game-session › leave", () => {
  it("Leaving returns at once: the start screen shows before the server confirms, and the token is gone", async () => {
    const room = fakeRoom({ leave: vi.fn(() => new Promise<number>(() => {})) });
    const { result } = await playingWith(room);

    act(() => result.current.leave());
    expect(room.leave).toHaveBeenCalledTimes(1);
    expect(room.removeAllListeners).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.view).toBeUndefined();
    expect(loadToken()).toBeUndefined();
  });

  it("a late onLeave after leave() changes nothing", async () => {
    const { room, fireLeave } = leavableRoom();
    const { result } = await playingWith(room);
    act(() => result.current.leave());
    act(() => fireLeave(CLOSE_CODES.KICKED));
    expect(result.current).toMatchObject({ status: "idle", startNotice: undefined });
  });

  it("a failing leave on the server side still leaves locally", async () => {
    const room = fakeRoom({ leave: vi.fn(async () => Promise.reject(new Error("closed"))) });
    const { result } = await playingWith(room);
    await act(async () => result.current.leave());
    expect(result.current.status).toBe("idle");
  });
});

describe("lobby › joining", () => {
  it("start-screen › Friends: createGame creates a new game (never joins one), sends the nickname and remembers it", async () => {
    // The connector has no join-or-create any more: the only server way in without an id is create.
    const connector = connectorWith({ create: vi.fn(async () => fakeRoom()) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.create).toHaveBeenCalledWith({ nickname: "Maija" });
    expect(loadNickname()).toBe("Maija");
  });

  it("Join by invite link or from the list", async () => {
    const connector = connectorWith({ joinById: vi.fn(async () => fakeRoom()) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.joinById("brave-otters-sing", "Pekka"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.joinById).toHaveBeenCalledWith("brave-otters-sing", { nickname: "Pekka" });
  });

  it("Game started meanwhile: a locked or missing game gives the not-open notice on the start screen", async () => {
    const connector = connectorWith({ joinById: vi.fn(async () => Promise.reject(matchMakeError('room "x" is locked', 522))) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.joinById("x", "Pekka"));
    await waitFor(() => expect(result.current.startNotice).toBe("notOpen"));
    expect(result.current.status).toBe("idle");
    expect(loadNickname()).toBe("");
  });

  it("Server full: the server-full notice, not the error state", async () => {
    const connector = connectorWith({ create: vi.fn(async () => Promise.reject(matchMakeError("SERVER_FULL", 526))) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.startNotice).toBe("serverFull"));
    expect(result.current.status).toBe("idle");
  });

  it("a network failure is the generic error; retry repeats the same attempt", async () => {
    const joinById = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(fakeRoom());
    const connector = connectorWith({ joinById });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.joinById("brave-otters-sing", "Pekka"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(joinById).toHaveBeenLastCalledWith("brave-otters-sing", { nickname: "Pekka" });
  });

  it("quick game against bots: creates a bot game with the count; retry repeats it", async () => {
    const createBotGame = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(fakeRoom());
    const { result } = renderHook(() => useSession(connectorWith({ createBotGame })));
    act(() => result.current.playBots("Maija", 3));
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(createBotGame).toHaveBeenCalledTimes(2);
    expect(createBotGame).toHaveBeenLastCalledWith({ nickname: "Maija", bots: 3 });
  });

  it("Host leaves: close code 4101 returns to the start screen with the host-left notice", async () => {
    const { room, fireLeave } = leavableRoom();
    const { result } = await playingWith(room);
    act(() => fireLeave(CLOSE_CODES.HOST_LEFT));
    expect(result.current).toMatchObject({ status: "idle", startNotice: "hostLeft" });
  });

  it("start sends the start command; a rejection gives its notice", async () => {
    const room = fakeRoom({ request: vi.fn(async () => ({ ok: false, code: "NOT_ENOUGH_PLAYERS" })) });
    const { result } = await playingWith(room);
    await act(async () => {
      await result.current.start();
    });
    expect(room.request).toHaveBeenCalledWith("start", {});
    expect(result.current.notice).toBe("errors.NOT_ENOUGH_PLAYERS");
  });
});

describe("lobby › view model", () => {
  it("the waiting room: phase, host, names, and nobody on turn", () => {
    const state = syncedState({}, { phase: "waiting", turnSeat: 0, hostSeat: 1 });
    state.players = new Map([
      ["me", { seat: 1, connected: true, name: "Maija" }],
      ["b", { seat: 2, connected: true, name: "Pekka" }],
    ]);
    const view = toLobbyView(state, "r", "b")!;
    expect(view).toMatchObject({ phase: "waiting", hostSeat: 1, turnSeat: 0, isMyTurn: false, canKick: false });
    expect(view.seats.map((s) => s.name)).toEqual(["Maija", "Pekka"]);
  });

  it("a started game is playing; a finished one is finished", () => {
    expect(toLobbyView(syncedState({ me: 1, b: 2 }, { phase: "shift" }), "r", "me")!.phase).toBe("playing");
    expect(toLobbyView(syncedState({ me: 1, b: 2 }, { phase: "finished" }), "r", "me")!.phase).toBe("finished");
  });
});

describe("game-session › turn rules in the view model", () => {
  const withPlayers = (players: [string, number, boolean][], turn: Partial<SyncedLobbyState>) => {
    const state = syncedState({}, turn);
    state.players = new Map(players.map(([id, seat, connected]) => [id, { seat, connected }]));
    return state;
  };

  it("passes the deadline and expiry through; only other seated players may kick", () => {
    const state = withPlayers([["me", 1, true], ["b", 2, true]], { turnSeat: 2, turnDeadline: 1234, turnExpired: true });
    expect(toLobbyView(state, "r", "me")).toMatchObject({ turnDeadline: 1234, turnExpired: true, canKick: true });
    expect(toLobbyView(state, "r", "b")!.canKick).toBe(false);
    expect(toLobbyView(state, "r", "spectator")!.canKick).toBe(false);
    const running = withPlayers([["me", 1, true], ["b", 2, true]], { turnSeat: 2, turnDeadline: 1234, turnExpired: false });
    expect(toLobbyView(running, "r", "me")!.canKick).toBe(false);
  });

  it("no clock and no kick in a finished game", () => {
    const state = withPlayers([["me", 1, true], ["b", 2, true]], { turnSeat: 2, phase: "finished", turnDeadline: 99, turnExpired: true });
    expect(toLobbyView(state, "r", "me")).toMatchObject({ turnDeadline: 0, turnExpired: false, canKick: false });
  });

  it("knows when the current player's connection has dropped", () => {
    const state = withPlayers([["me", 1, true], ["b", 2, false]], { turnSeat: 2 });
    expect(toLobbyView(state, "r", "me")!.turnDisconnected).toBe(true);
    expect(toLobbyView({ ...state, turnSeat: 1 }, "r", "me")!.turnDisconnected).toBe(false);
  });
});

describe("game-session › kick", () => {
  it("sends the seat; a rejection gives its notice", async () => {
    const room = fakeRoom({ request: vi.fn(async () => ({ ok: false, code: "TURN_NOT_EXPIRED" })) });
    const connector = connectorWith({ create: vi.fn(async () => room), reconnect: vi.fn() });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));

    await act(async () => {
      await result.current.kick(2);
    });
    expect(room.request).toHaveBeenCalledWith("kick", { seat: 2 });
    expect(result.current.notice).toBe("errors.TURN_NOT_EXPIRED");
  });

  it("Kicked: close code 4100 returns to the start screen with the reason, cleared by Play", async () => {
    let onLeave: (code: number) => void = () => {};
    const room = fakeRoom({ onLeave: vi.fn((cb: (code: number) => void) => (onLeave = cb)) });
    const connector = connectorWith({ create: vi.fn(async () => room), reconnect: vi.fn() });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));

    act(() => onLeave(4100));
    expect(result.current).toMatchObject({ status: "idle", startNotice: "kicked" });
    act(() => result.current.createGame("Maija"));
    expect(result.current.startNotice).toBeUndefined();
  });

  it("an ordinary leave has no end reason", async () => {
    let onLeave: (code: number) => void = () => {};
    const room = fakeRoom({ onLeave: vi.fn((cb: (code: number) => void) => (onLeave = cb)) });
    const connector = connectorWith({ create: vi.fn(async () => room), reconnect: vi.fn() });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    act(() => onLeave(4000));
    expect(result.current.startNotice).toBeUndefined();
  });
});

describe("spectators › view model", () => {
  const watched = (turn: Partial<SyncedLobbyState> = {}, bots = false) => {
    const state = syncedState({}, { turnSeat: 2, spectators: 2, botSpeed: 2, ...turn });
    state.players = new Map([
      ["a", { seat: 1, connected: true, bot: bots }],
      ["b", { seat: 2, connected: true, bot: bots }],
    ]);
    return toLobbyView(state, "r", "me")!;
  };

  it("a spectator: no seat, nobody's turn is theirs, nothing to kick", () => {
    const view = watched();
    expect(view).toMatchObject({ spectating: true, spectators: 2, botSpeed: 2, botOnly: false, isMyTurn: false, canKick: false });
  });

  it("only bots seated: botOnly; a seated player is not spectating", () => {
    expect(watched({}, true).botOnly).toBe(true);
    const state = syncedState({ me: 1, other: 2 }, { spectators: 1 });
    const view = toLobbyView(state, "r", "me")!;
    expect(view).toMatchObject({ spectating: false, spectators: 1, rematchRoomId: undefined });
  });

  it("the rematch id comes through once set", () => {
    expect(toLobbyView(syncedState({ me: 1 }, { rematchRoomId: "calm-foxes-jump" }), "r", "me")!.rematchRoomId).toBe("calm-foxes-jump");
  });
});

describe("spectators › session", () => {
  it("watch joins through the watch route under the nickname", async () => {
    const connector = connectorWith({ watch: vi.fn(async () => fakeRoom({ state: syncedState({ other: 2 }) })) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.watch("calm-foxes-jump", "Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.watch).toHaveBeenCalledWith("calm-foxes-jump", { nickname: "Maija" });
    expect(result.current.view?.spectating).toBe(true);
  });

  it("a game that cannot be watched gives the not-open notice", async () => {
    const connector = connectorWith({ watch: vi.fn(async () => Promise.reject(new Error("NOT_WATCHABLE"))) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.watch("x", "Maija"));
    await waitFor(() => expect(result.current.startNotice).toBe("notOpen"));
  });

  it("watchBots starts a watched bot game with count and speed, leaving the current game first", async () => {
    const first = fakeRoom();
    const createBotWatch = vi.fn(async () => fakeRoom({ roomId: "second" }));
    const connector = connectorWith({ create: vi.fn(async () => first), createBotWatch });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    act(() => result.current.watchBots("Maija", 3, 2));
    await waitFor(() => expect(result.current.view?.roomId).toBe("second"));
    expect(createBotWatch).toHaveBeenCalledWith({ bots: 3, speed: 2 });
    expect(first.leave).toHaveBeenCalledTimes(1);
  });

  it("Invite to a running game: joining fails as not open, so it watches and says so once", async () => {
    const connector = connectorWith({
      joinById: vi.fn(async () => Promise.reject(matchMakeError("room is locked", 522))),
      watch: vi.fn(async () => fakeRoom({ state: syncedState({ other: 2 }) })),
    });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.joinInvite("calm-foxes-jump", "Pekka"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.watch).toHaveBeenCalledWith("calm-foxes-jump", { nickname: "Pekka" });
    expect(result.current.notice).toBe("spectate.lateInvite");
  });

  it("Invite to a finished game: not open when watching fails too", async () => {
    const connector = connectorWith({
      joinById: vi.fn(async () => Promise.reject(matchMakeError("room is locked", 522))),
      watch: vi.fn(async () => Promise.reject(new Error("NOT_WATCHABLE"))),
    });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.joinInvite("x", "Pekka"));
    await waitFor(() => expect(result.current.startNotice).toBe("notOpen"));
  });

  it("setSpeed sends the speed", async () => {
    const room = fakeRoom();
    const { result } = await playingWith(room);
    await act(() => result.current.setSpeed(4));
    expect(room.request).toHaveBeenCalledWith("setSpeed", { speed: 4 });
  });
});

describe("game-session › Rematch", () => {
  /** A finished game the test can push state changes into. */
  function finishedRoom() {
    let push: (state: SyncedLobbyState) => void = () => {};
    const state = syncedState({ me: 1, other: 2 }, { phase: "finished", winners: [1] });
    (state.players as Map<string, object>).set("me", { seat: 1, connected: true, name: "Maija" });
    const room = fakeRoom({ state, onStateChange: vi.fn((cb: (s: SyncedLobbyState) => void) => (push = cb)) });
    return {
      room,
      state,
      push: (next: Partial<SyncedLobbyState>) =>
        act(() => {
          Object.assign(state, next);
          push(state);
        }),
    };
  }

  it("First player asks for a rematch: sends it, then joins the new game under the same name", async () => {
    const { room, push } = finishedRoom();
    const next = fakeRoom({ roomId: "calm-foxes-jump" });
    const connector = connectorWith({ create: vi.fn(async () => room), joinById: vi.fn(async () => next) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    act(() => result.current.rematch());
    expect(result.current.rematching).toBe(true);
    await waitFor(() => expect(room.request).toHaveBeenCalledWith("rematch", {}));
    push({ rematchRoomId: "calm-foxes-jump" });
    await waitFor(() => expect(result.current.view?.roomId).toBe("calm-foxes-jump"));
    expect(connector.joinById).toHaveBeenCalledWith("calm-foxes-jump", { nickname: "Maija" });
    expect(room.leave).toHaveBeenCalledTimes(1);
    expect(result.current.rematching).toBe(false);
  });

  it("Second player follows: the id is known, so no command is sent", async () => {
    const { room } = finishedRoom();
    room.state.rematchRoomId = "calm-foxes-jump";
    const connector = connectorWith({ create: vi.fn(async () => room), joinById: vi.fn(async () => fakeRoom({ roomId: "calm-foxes-jump" })) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    act(() => result.current.rematch());
    await waitFor(() => expect(result.current.view?.roomId).toBe("calm-foxes-jump"));
    expect(room.request).not.toHaveBeenCalled();
  });

  it("Rematch already started: not open on the start screen", async () => {
    const { room } = finishedRoom();
    room.state.rematchRoomId = "calm-foxes-jump";
    const connector = connectorWith({
      create: vi.fn(async () => room),
      joinById: vi.fn(async () => Promise.reject(matchMakeError("room is locked", 522))),
    });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.createGame("Maija"));
    await waitFor(() => expect(result.current.status).toBe("playing"));
    act(() => result.current.rematch());
    await waitFor(() => expect(result.current.startNotice).toBe("notOpen"));
    expect(result.current.status).toBe("idle");
  });

  it("a rejected rematch gives its notice and can be tried again", async () => {
    const { room } = finishedRoom();
    room.request = vi.fn(async () => ({ ok: false, code: "SERVER_FULL" }));
    const { result } = await playingWith(room);
    act(() => result.current.rematch());
    await waitFor(() => expect(result.current.notice).toBe("errors.SERVER_FULL"));
    expect(result.current.rematching).toBe(false);
  });
});

describe("game-session › Resume after closing the app", () => {
  it("a seated player's game is remembered; leaving forgets it", async () => {
    const { result } = await playingWith(fakeRoom());
    expect(loadResume()).toMatchObject({ token: "brave-otters-sing:token", roomId: "brave-otters-sing" });
    act(() => result.current.leave());
    expect(loadResume()).toBeUndefined();
  });

  it("a spectator's game and a finished game are not remembered", async () => {
    await playingWith(fakeRoom({ state: syncedState({ a: 1, b: 2 }) }));
    expect(loadResume()).toBeUndefined();
    sessionStorage.clear();

    let push: (state: SyncedLobbyState) => void = () => {};
    await playingWith(fakeRoom({ onStateChange: vi.fn((cb: (state: SyncedLobbyState) => void) => (push = cb)) }));
    expect(loadResume()).toBeDefined();
    act(() => push(syncedState({ me: 1, other: 2 }, { phase: "finished" })));
    expect(loadResume()).toBeUndefined();
  });

  it("App reopened mid-game: offered, and resuming reconnects with the remembered token", async () => {
    saveResume("kept-token", "brave-otters-sing");
    const connector = connectorWith({ reconnect: vi.fn(async () => fakeRoom()) });
    const { result } = renderHook(() => useSession(connector));
    expect(result.current.status).toBe("idle");
    expect(result.current.resumable?.roomId).toBe("brave-otters-sing");

    act(() => result.current.resume());
    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(connector.reconnect).toHaveBeenCalledWith("kept-token");
    expect(result.current.resumable).toBeUndefined();
    expect(loadResume()?.token).toBe("brave-otters-sing:token");
  });

  it("Seat already gone: the resumeGone notice, and the offer is gone", async () => {
    saveResume("kept-token", "brave-otters-sing");
    const connector = connectorWith({ reconnect: vi.fn(async () => Promise.reject(new Error("expired"))) });
    const { result } = renderHook(() => useSession(connector));
    act(() => result.current.resume());
    await waitFor(() => expect(result.current.startNotice).toBe("resumeGone"));
    expect(result.current.status).toBe("idle");
    expect(result.current.resumable).toBeUndefined();
    expect(loadResume()).toBeUndefined();
  });

  it("Another game started instead: the old game is forgotten", async () => {
    saveResume("kept-token", "old-room");
    const { result } = await playingWith(fakeRoom({ roomId: "new-room" }));
    expect(result.current.resumable).toBeUndefined();
    expect(loadResume()?.roomId).toBe("new-room");
  });

  it("a tab with its own token rejoins by itself and offers nothing", () => {
    saveToken("tab-token");
    saveResume("kept-token", "r");
    const connector = connectorWith({ reconnect: vi.fn(() => new Promise<GameRoomLike>(() => {})) });
    const { result } = renderHook(() => useSession(connector));
    expect(result.current.resumable).toBeUndefined();
  });
});
