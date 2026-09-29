import type { BotSpeed } from "@palikka/protocol";
import { PIECE_COUNT, type Game } from "@palikka/rules";

/**
 * The game against bots that runs on this device, kept in localStorage so a reload, an update or a
 * reopened app continues it. Storage blocked (private mode): the game still plays, it just cannot
 * be continued.
 */
const KEY = "palikka.localGame";

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

export interface SavedLocalGame {
  roomId: string;
  game: Game;
  /** The player's seat is handed to the bot. */
  autoplay?: boolean;
  /** The next game's id once "Pelaa uudelleen" was tapped. */
  rematchRoomId?: string;
  /** A game of bots to watch: the bots' speed (every pause divided by it). */
  speed?: BotSpeed;
  /** The game before each of the player's own moves, for "Peru" (the last is undone first). */
  history?: Game[];
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

export function saveLocalGame(saved: SavedLocalGame, store = storage()): void {
  try {
    store?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked or full: play on without resuming.
  }
}

const isInt = (value: unknown, min: number, max: number): boolean => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Throws unless `game` looks like a game of the current rules (an old or broken save is dropped). */
function checkGame(game: Game): Game {
  const { position, seats } = game;
  const { size } = position.config;
  const ok =
    Array.isArray(seats) &&
    Array.isArray(game.left) &&
    Array.isArray(game.winners) &&
    Array.isArray(position.colours) &&
    position.colours.every((c) => isInt(c, 1, 4) && Array.isArray(position.placed[c]) && position.placed[c]!.every((p) => isInt(p, 0, PIECE_COUNT - 1))) &&
    Array.isArray(position.cells) &&
    position.cells.length === size * size &&
    position.cells.every((owner) => isInt(owner, 0, 4)) &&
    Array.isArray(position.out);
  if (!ok) throw new Error("Not a saved game of the current rules");
  return game;
}

/** The saved game with this room id; undefined when there is none, another one, or an old or broken record. */
export function loadLocalGame(roomId: string, store = storage()): SavedLocalGame | undefined {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as SavedLocalGame;
    if (saved.roomId !== roomId) return undefined;
    return { ...saved, game: checkGame(saved.game), history: saved.history?.map(checkGame) };
  } catch {
    clearLocalGame(roomId, store, true);
    return undefined;
  }
}

/** Forgets the saved game `roomId`; a newer one in the slot stays unless `broken` says the slot is unreadable. */
export function clearLocalGame(roomId: string, store = storage(), broken = false): void {
  try {
    if (!broken) {
      const raw = store?.getItem(KEY);
      if (!raw || (JSON.parse(raw) as Partial<SavedLocalGame>).roomId !== roomId) return;
    }
    store?.removeItem(KEY);
  } catch {
    // ignore
  }
}
