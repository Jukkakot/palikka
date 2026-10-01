import { useEffect, useState } from "react";
import { log } from "../logging/logger.ts";
import { sdkClient } from "./useKitSession.ts";

/** A public game still in its waiting room with a free seat. */
export interface OpenGame<O = unknown> {
  roomId: string;
  /** The host's nickname. */
  host: string;
  /** Seats taken, by people and bots. */
  seated: number;
  /** The game's options (the game's defaults from an older server). */
  options: O;
  /** Seats the options take. */
  maxSeats: number;
}

export interface OpenGames<O = unknown> {
  /** "loading" until the first list arrived; "failed" when the lobby could not be reached. */
  status: "off" | "loading" | "ready" | "failed";
  games: OpenGame<O>[];
  /** Public games being played, to watch (`seated` = players, people and bots). */
  running: OpenGame<O>[];
}

/** A room as the built-in lobby lists it (the fields used here). */
export interface RoomListing {
  roomId: string;
  clients: number;
  maxClients: number;
  locked?: boolean;
  createdAt?: string | number | Date;
  metadata?: { host?: unknown; open?: unknown; pool?: unknown; seated?: unknown; watchable?: unknown; options?: unknown };
}

/** The parts of the SDK's lobby room this hook uses. */
export interface LobbyRoomLike {
  onMessage(type: "rooms", cb: (rooms: RoomListing[]) => void): unknown;
  onMessage(type: "+", cb: (entry: [string, RoomListing]) => void): unknown;
  onMessage(type: "-", cb: (roomId: string) => void): unknown;
  leave(): Promise<unknown>;
}

export type LobbyConnector = (pool: string) => Promise<LobbyRoomLike>;

/** Joins the server's `lobby` room, which pushes the public games of `pool`, open or running (the server filters by metadata). */
export const connectLobby: LobbyConnector = (pool) =>
  sdkClient().joinOrCreate("lobby", { filter: { name: "game", metadata: { pool } } }) as unknown as Promise<LobbyRoomLike>;

const time = (r: RoomListing) => (r.createdAt === undefined ? 0 : new Date(r.createdAt).getTime() || 0);

/** Seats taken: people and bots from the metadata, or the connected people from an older server. */
const seatedOf = (r: RoomListing) => (typeof r.metadata?.seated === "number" ? r.metadata.seated : r.clients);

const hostOf = (r: RoomListing) => (typeof r.metadata?.host === "string" ? r.metadata.host : "");

/** How a game reads the options of a listing: its options (defaults for anything unknown) and their seat count. */
export interface ListingOptions<O> {
  options(raw: unknown): O;
  maxSeats(options: O): number;
}

const toEntry = <O>(r: RoomListing, read: ListingOptions<O>): OpenGame<O> => {
  const options = read.options(r.metadata?.options);
  return { roomId: r.roomId, host: hostOf(r), seated: seatedOf(r), options, maxSeats: read.maxSeats(options) };
};

/**
 * Joinable entries, oldest first: the server lists locked and full rooms too. A game whose host has
 * not joined yet (a rematch game, for a moment) is left out.
 */
export function toOpenGames<O>(rooms: Iterable<RoomListing>, read: ListingOptions<O>): OpenGame<O>[] {
  return [...rooms]
    .map((r) => ({ r, entry: toEntry(r, read) }))
    .filter(({ r, entry }) => !r.locked && r.clients < r.maxClients && entry.seated < entry.maxSeats && r.metadata?.open === true && entry.host !== "")
    .sort((a, b) => time(a.r) - time(b.r))
    .map(({ entry }) => entry);
}

/** Running games that take another spectator, oldest first. */
export function toRunningGames<O>(rooms: Iterable<RoomListing>, read: ListingOptions<O>): OpenGame<O>[] {
  return [...rooms]
    .filter((r) => r.metadata?.watchable === true)
    .sort((a, b) => time(a) - time(b))
    .map((r) => toEntry(r, read));
}

/**
 * The live list of open public games in `pool`, kept while `enabled` (the start screen is shown and
 * the server wake-up is over). Leaves the lobby when disabled or unmounted.
 */
export function useOpenGames<O>(read: ListingOptions<O>, pool: string, enabled: boolean, connect: LobbyConnector = connectLobby): OpenGames<O> {
  // What the current connection delivered, tagged with its pool; cleared when the connection ends.
  const [loaded, setLoaded] = useState<{ pool: string; state: OpenGames<O> }>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let lobby: LobbyRoomLike | undefined;
    const rooms = new Map<string, RoomListing>();
    const publish = (state: OpenGames<O>) => active && setLoaded({ pool, state });
    const publishRooms = () => publish({ status: "ready", games: toOpenGames(rooms.values(), read), running: toRunningGames(rooms.values(), read) });

    connect(pool)
      .then((room) => {
        lobby = room;
        if (!active) {
          void room.leave().catch(() => {});
          return;
        }
        room.onMessage("rooms", (list) => {
          rooms.clear();
          for (const r of list) rooms.set(r.roomId, r);
          publishRooms();
        });
        room.onMessage("+", ([roomId, r]) => {
          rooms.set(roomId, r);
          publishRooms();
        });
        room.onMessage("-", (roomId) => {
          rooms.delete(roomId);
          publishRooms();
        });
      })
      .catch((err: unknown) => {
        log.warn("client.warn", { kind: "lobby" }, err instanceof Error ? err.message : String(err));
        publish({ status: "failed", games: [], running: [] });
      });

    return () => {
      active = false;
      setLoaded(undefined);
      void lobby?.leave().catch(() => {});
    };
  }, [pool, enabled, connect, read]);

  if (!enabled) return OFF as OpenGames<O>;
  return loaded?.pool === pool ? loaded.state : (LOADING as OpenGames<O>);
}

const OFF: OpenGames = { status: "off", games: [], running: [] };
const LOADING: OpenGames = { status: "loading", games: [], running: [] };
