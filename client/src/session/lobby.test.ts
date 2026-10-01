// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { saveNickname, saveToken, toOpenGames, type RoomListing } from "@game-kit/client";
import { devBotCount, devWatchCount } from "./devShortcut.ts";
import { palikkaListing } from "./palikkaClient.ts";

const listing = (roomId: string, extra: Partial<RoomListing> = {}): RoomListing => ({
  roomId,
  clients: 1,
  maxClients: 4,
  locked: false,
  createdAt: "2026-09-26T10:00:00.000Z",
  metadata: { host: "Maija", open: true, pool: "" },
  ...extra,
});

describe("lobby › Palikka's storage keys", () => {
  it("the kit stores under palikka.*, as before the kit", () => {
    saveNickname("Maija");
    saveToken("t");
    expect([localStorage.getItem("palikka.nickname"), sessionStorage.getItem("palikka.session")]).toEqual(["Maija", "t"]);
  });
});

describe("lobby › Open games list (variants)", () => {
  it("a Duo game is full with two seated and shows its variant", () => {
    const games = toOpenGames([
      listing("duo-open", { metadata: { host: "Maija", open: true, seated: 1, options: { variant: "duo" } } }),
      listing("duo-full", { metadata: { host: "Pekka", open: true, seated: 2, options: { variant: "duo" } } }),
    ], palikkaListing);
    expect(games).toEqual([{ roomId: "duo-open", host: "Maija", seated: 1, options: { variant: "duo" }, maxSeats: 2 }]);
  });

  it("a listing without options is a Perus game of four", () => {
    expect(toOpenGames([listing("old-server")], palikkaListing)).toEqual([{ roomId: "old-server", host: "Maija", seated: 1, options: { variant: "classic" }, maxSeats: 4 }]);
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
