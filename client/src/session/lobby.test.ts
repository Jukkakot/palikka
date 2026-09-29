// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { devBotCount, devWatchCount } from "./devShortcut.ts";
import { dropInviteFromUrl, inviteFromUrl, inviteUrl } from "./inviteLink.ts";
import { checkNickname, loadNickname, NAME_LANGUAGES, nameWords, randomNickname, saveNickname } from "./nickname.ts";
import { toOpenGames, toRunningGames, useOpenGames, type LobbyRoomLike, type RoomListing } from "./useOpenGames.ts";

const listing = (roomId: string, extra: Partial<RoomListing> = {}): RoomListing => ({
  roomId,
  clients: 1,
  maxClients: 4,
  locked: false,
  createdAt: "2026-09-26T10:00:00.000Z",
  metadata: { host: "Maija", open: true, pool: "" },
  ...extra,
});

/** A fake lobby room: the test pushes the server's messages. */
function fakeLobby() {
  const handlers = new Map<string, (payload: never) => void>();
  const room = {
    onMessage: vi.fn((type: string, cb: (payload: never) => void) => handlers.set(type, cb)),
    leave: vi.fn(async () => 1000),
  };
  const push = (type: "rooms" | "+" | "-", payload: unknown) => act(() => handlers.get(type)!(payload as never));
  return { room: room as unknown as LobbyRoomLike & typeof room, push };
}

beforeEach(() => localStorage.clear());

describe("lobby › Nickname store and rule", () => {
  it("remembers the last nickname in this browser", () => {
    expect(loadNickname()).toBe("");
    saveNickname("Maija");
    expect(loadNickname()).toBe("Maija");
    expect(localStorage.getItem("labyrinth.nickname")).toBe("Maija");
  });

  it("blocked storage neither throws nor remembers", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadNickname(blocked)).toBe("");
    expect(() => saveNickname("Maija", blocked)).not.toThrow();
  });

  it("checks with the server's rule and trims", () => {
    expect(checkNickname("  Maija ")).toEqual({ ok: true, nickname: "Maija" });
    expect(checkNickname("M")).toEqual({ ok: false, issue: "length" });
    expect(checkNickname("   ")).toEqual({ ok: false, issue: "length" });
    expect(checkNickname("x".repeat(17))).toEqual({ ok: false, issue: "length" });
    expect(checkNickname("Ma\tija")).toEqual({ ok: false, issue: "characters" });
  });
});

describe("lobby › Random name for a new player", () => {
  it("every adjective and animal pair passes the nickname rule, in every language", () => {
    for (const language of NAME_LANGUAGES) {
      const { adjectives, animals } = nameWords(language);
      expect(adjectives.length * animals.length).toBeGreaterThanOrEqual(500);
      for (const a of adjectives) for (const b of animals) expect(checkNickname(`${a} ${b}`).ok, `${a} ${b}`).toBe(true);
    }
  });

  it("uses the UI language's words (Finnish when unknown) and follows the random source", () => {
    expect(randomNickname("fi", () => 0)).toBe("Rohkea Ilves");
    expect(randomNickname("en-GB", () => 0)).toBe("Brave Lynx");
    expect(randomNickname("sv", () => 0)).toBe("Rohkea Ilves");
    expect(randomNickname("en", () => 0.999)).toBe("Rapid Heron");
  });
});

describe("lobby › Open games list", () => {
  it("lists only joinable public entries, oldest first", () => {
    const games = toOpenGames([
      listing("new", { createdAt: "2026-09-26T11:00:00.000Z", metadata: { host: "Pekka", open: true } }),
      listing("old", { createdAt: "2026-09-26T09:00:00.000Z" }),
      listing("full", { clients: 4 }),
      listing("bots", { clients: 1, maxClients: 1, metadata: { host: "Olli", open: true, seated: 4 } }),
      listing("oneBot", { createdAt: "2026-09-26T12:00:00.000Z", metadata: { host: "Liisa", open: true, seated: 2 } }),
      listing("locked", { locked: true }),
      listing("started", { metadata: { host: "Olli", open: false } }),
    ]);
    expect(games).toEqual([
      { roomId: "old", host: "Maija", seated: 1 },
      { roomId: "new", host: "Pekka", seated: 1 },
      { roomId: "oneBot", host: "Liisa", seated: 2 },
    ]);
  });

  it("A game appears, updates to full and disappears; the lobby is left on unmount", async () => {
    const { room, push } = fakeLobby();
    const connect = vi.fn(async () => room);
    const { result, unmount } = renderHook(() => useOpenGames("", true, connect));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(room.onMessage).toHaveBeenCalledTimes(3));
    expect(connect).toHaveBeenCalledWith("");

    push("rooms", []);
    expect(result.current).toEqual({ status: "ready", games: [], running: [] });
    push("+", ["brave-otters-sing", listing("brave-otters-sing")]);
    expect(result.current.games).toEqual([{ roomId: "brave-otters-sing", host: "Maija", seated: 1 }]);
    push("+", ["brave-otters-sing", listing("brave-otters-sing", { clients: 4, locked: true })]);
    expect(result.current.games).toEqual([]);
    push("+", ["calm-foxes-jump", listing("calm-foxes-jump")]);
    push("-", "calm-foxes-jump");
    expect(result.current.games).toEqual([]);

    unmount();
    expect(room.leave).toHaveBeenCalledTimes(1);
  });

  it("waits while disabled (server still waking or a game open), and leaves when disabled again", async () => {
    const { room } = fakeLobby();
    const connect = vi.fn(async () => room);
    const { result, rerender } = renderHook(({ on }) => useOpenGames("e2e-1", on, connect), { initialProps: { on: false } });
    expect(result.current.status).toBe("off");
    expect(connect).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(connect).toHaveBeenCalledWith("e2e-1"));
    await waitFor(() => expect(room.onMessage).toHaveBeenCalled());
    rerender({ on: false });
    expect(room.leave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("off");
  });

  it("a lobby that cannot be reached leaves a quiet failed state", async () => {
    const connect = vi.fn(async () => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useOpenGames("", true, connect));
    await waitFor(() => expect(result.current.status).toBe("failed"));
  });
});

describe("spectators › running games", () => {
  it("lists watchable games apart from the open ones; a rematch game without its host yet is hidden", () => {
    const rooms = [
      listing("open-game"),
      listing("running-game", { locked: true, metadata: { host: "Pekka", open: false, pool: "", seated: 3, watchable: true } }),
      listing("full-of-spectators", { locked: true, metadata: { host: "Liisa", open: false, pool: "", seated: 2, watchable: false } }),
      listing("rematch-no-host", { metadata: { host: "", open: true, pool: "", seated: 1 } }),
    ];
    expect(toOpenGames(rooms).map((g) => g.roomId)).toEqual(["open-game"]);
    expect(toRunningGames(rooms)).toEqual([{ roomId: "running-game", host: "Pekka", seated: 3 }]);
  });
});

describe("development shortcut ?dev=0vN", () => {
  it("reads 0v2–0v4 in development only", () => {
    expect(devWatchCount("?dev=0v3", true)).toBe(3);
    expect(devWatchCount("?dev=0v1", true)).toBeUndefined();
    expect(devWatchCount("?dev=1v3", true)).toBeUndefined();
    expect(devWatchCount("?dev=0v2", false)).toBeUndefined();
  });
});

describe("development shortcut ?dev=1vN", () => {
  it("reads 1v1–1v3 in development only", () => {
    expect(devBotCount("?dev=1v3", true)).toBe(3);
    expect(devBotCount("?pool=x&dev=1v1", true)).toBe(1);
    expect(devBotCount("?dev=1v4", true)).toBeUndefined();
    expect(devBotCount("", true)).toBeUndefined();
    expect(devBotCount("?dev=1v2", false)).toBeUndefined();
  });
});

describe("lobby › Invite link", () => {
  it("reads ?game= and ignores anything that is not a game id", () => {
    expect(inviteFromUrl("?game=brave-otters-sing")).toBe("brave-otters-sing");
    expect(inviteFromUrl("?pool=x&game=Calm-Foxes-Jump")).toBe("calm-foxes-jump");
    expect(inviteFromUrl("?game=")).toBeUndefined();
    expect(inviteFromUrl("?game=<script>")).toBeUndefined();
    expect(inviteFromUrl("")).toBeUndefined();
  });

  it("builds the invite link from this page, keeping the pool", () => {
    const location = { origin: "https://example.org", pathname: "/labyrinth/", search: "?pool=e2e-1&game=old" };
    expect(inviteUrl("brave-otters-sing", location)).toBe("https://example.org/labyrinth/?pool=e2e-1&game=brave-otters-sing");
    expect(inviteUrl("brave-otters-sing", { ...location, search: "" })).toBe("https://example.org/labyrinth/?game=brave-otters-sing");
  });

  it("the URL is cleaned after the invite: game goes, pool stays", () => {
    window.history.replaceState(null, "", "/labyrinth/?pool=e2e-1&game=brave-otters-sing");
    dropInviteFromUrl();
    expect(window.location.search).toBe("?pool=e2e-1");
    window.history.replaceState(null, "", "/");
  });
});
