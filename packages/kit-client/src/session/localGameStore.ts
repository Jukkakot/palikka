import type { BotSpeed, Seat } from "@game-kit/protocol";

/**
 * The game against bots that runs on this device, kept in localStorage so a reload, an update or a
 * reopened app continues it. Storage blocked (private mode): the game still plays, it just cannot
 * be continued. The kit owns the envelope; the game owns what is inside `game`.
 */

/** Room ids of games on the device start with this; server ids never do. */
export const LOCAL_ROOM_PREFIX = "local-";
/** Room ids of games of bots to watch: local room ids that are never saved. */
export const WATCH_ROOM_PREFIX = `${LOCAL_ROOM_PREFIX}watch-`;
/** Reconnection tokens of games on the device: this prefix and the room id. */
export const LOCAL_TOKEN_PREFIX = "local:";

export const isLocalRoomId = (roomId: string): boolean => roomId.startsWith(LOCAL_ROOM_PREFIX);
export const isWatchRoomId = (roomId: string): boolean => roomId.startsWith(WATCH_ROOM_PREFIX);
export const isLocalToken = (token: string): boolean => token.startsWith(LOCAL_TOKEN_PREFIX);
export const localToken = (roomId: string): string => LOCAL_TOKEN_PREFIX + roomId;
export const roomIdOfToken = (token: string): string => token.slice(LOCAL_TOKEN_PREFIX.length);

/** The envelope's version; a save of another version (or none: from before the kit) is dropped. */
export const LOCAL_SAVE_VERSION = 2;

/** One entry of the undo history: the game before a move, and the seat that made it. */
export interface HistoryEntry<G> {
  seat: number;
  game: G;
}

export interface SavedLocalGame<G, O> {
  version: typeof LOCAL_SAVE_VERSION;
  roomId: string;
  game: G;
  /** The seats: the player (unless only bots play) and the bots; a rematch keeps them. */
  seats: Seat[];
  /** The game's options, which a rematch keeps. */
  options: O;
  /** The player's seat is handed to the bot. */
  autoplay?: boolean;
  /** The next game's id once "Pelaa uudelleen" was tapped. */
  rematchRoomId?: string;
  /** A game of bots to watch: the bots' speed (every pause divided by it). */
  speed?: BotSpeed;
  /** The game before each of the player's own moves, for "Peru" (the last is undone first). */
  history?: HistoryEntry<G>[];
}

/** Where a game keeps its device game and how it checks one. */
export interface LocalSaveFormat<G> {
  /** The storage key, e.g. `palikka.localGame`. */
  key: string;
  /** Returns the game, or throws unless it looks like a game of the current rules (an old or broken save is dropped). */
  check(game: unknown): G;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** A new room id for a game on the device (`prefix` picks the kind). */
export function newLocalRoomId(random = Math.random, prefix = LOCAL_ROOM_PREFIX): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(random() * 36 ** 4).toString(36)}`;
}

export function saveLocalGame<G, O>(saved: SavedLocalGame<G, O>, format: LocalSaveFormat<G>, store = storage()): void {
  try {
    store?.setItem(format.key, JSON.stringify(saved));
  } catch {
    // Storage blocked or full: play on without resuming.
  }
}

/** The saved game with this room id; undefined when there is none, another one, or an old or broken record. */
export function loadLocalGame<G, O>(roomId: string, format: LocalSaveFormat<G>, store = storage()): SavedLocalGame<G, O> | undefined {
  try {
    const raw = store?.getItem(format.key);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as SavedLocalGame<G, O>;
    if (saved.roomId !== roomId) return undefined;
    if (saved.version !== LOCAL_SAVE_VERSION || !Array.isArray(saved.seats)) throw new Error("A save of another version");
    return {
      ...saved,
      game: format.check(saved.game),
      history: saved.history?.map(({ seat, game }) => {
        if (!Number.isInteger(seat)) throw new Error("A broken history entry");
        return { seat, game: format.check(game) };
      }),
    };
  } catch {
    clearLocalGame(roomId, format, store, true);
    return undefined;
  }
}

/** Forgets the saved game `roomId`; a newer one in the slot stays unless `broken` says the slot is unreadable. */
export function clearLocalGame<G>(roomId: string, format: LocalSaveFormat<G>, store = storage(), broken = false): void {
  try {
    if (!broken) {
      const raw = store?.getItem(format.key);
      if (!raw || (JSON.parse(raw) as { roomId?: unknown }).roomId !== roomId) return;
    }
    store?.removeItem(format.key);
  } catch {
    // ignore
  }
}
