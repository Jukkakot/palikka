import type { BotSpeed } from "@palikka/protocol";
import { checkBoard, type GameState } from "@palikka/rules";

/**
 * The games that run on this device, kept in localStorage so a reload, an update or a reopened app
 * continues them: one quick game against bots and, in a slot of its own, the daily puzzle. Storage
 * blocked (private mode): the game still plays, it just cannot be continued.
 */
const KEY = "palikka.localGame";
const DAILY_KEY = "palikka.dailyGame";

/** Room ids of games on the device start with this; server ids never do. */
export const LOCAL_ROOM_PREFIX = "local-";
/** Room ids of daily puzzles: local room ids with a save slot of their own. */
export const DAILY_ROOM_PREFIX = `${LOCAL_ROOM_PREFIX}daily-`;
/** Room ids of games of bots to watch: local room ids that are never saved. */
export const WATCH_ROOM_PREFIX = `${LOCAL_ROOM_PREFIX}watch-`;
/** Reconnection tokens of games on the device: this prefix and the room id. */
export const LOCAL_TOKEN_PREFIX = "local:";

export const isLocalRoomId = (roomId: string): boolean => roomId.startsWith(LOCAL_ROOM_PREFIX);
export const isDailyRoomId = (roomId: string): boolean => roomId.startsWith(DAILY_ROOM_PREFIX);
export const isWatchRoomId = (roomId: string): boolean => roomId.startsWith(WATCH_ROOM_PREFIX);
export const isLocalToken = (token: string): boolean => token.startsWith(LOCAL_TOKEN_PREFIX);
export const localToken = (roomId: string): string => LOCAL_TOKEN_PREFIX + roomId;
export const roomIdOfToken = (token: string): string => token.slice(LOCAL_TOKEN_PREFIX.length);

const keyOf = (roomId: string) => (isDailyRoomId(roomId) ? DAILY_KEY : KEY);

export interface SavedLocalGame {
  roomId: string;
  game: GameState;
  /** The player's seat is handed to the bot. */
  autoplay?: boolean;
  /** The next game's id once "Pelaa uudelleen" was tapped. */
  rematchRoomId?: string;
  /** A game of bots to watch: the bots' speed (every pause divided by it). */
  speed?: BotSpeed;
  /** Daily puzzle: the fewest turns possible. */
  par?: number;
  /** Daily puzzle: the states before each placement, for undo (the last is undone first). */
  history?: { game: GameState }[];
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
    store?.setItem(keyOf(saved.roomId), JSON.stringify(saved));
  } catch {
    // Storage blocked or full: play on without resuming.
  }
}

/** The saved game with this room id; undefined when there is none, another one, or a broken record. */
export function loadLocalGame(roomId: string, store = storage()): SavedLocalGame | undefined {
  try {
    const raw = store?.getItem(keyOf(roomId));
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as SavedLocalGame;
    if (saved.roomId !== roomId) return undefined;
    // Validates the board: a broken record is dropped.
    const revive = (game: GameState): GameState => ({ ...game, board: checkBoard(game.board) });
    return { ...saved, game: revive(saved.game), history: saved.history?.map((h) => ({ ...h, game: revive(h.game) })) };
  } catch {
    clearLocalGame(roomId, store, true);
    return undefined;
  }
}

/** Forgets the saved game `roomId`; a newer one in its slot stays unless `broken` says the slot is unreadable. */
export function clearLocalGame(roomId: string, store = storage(), broken = false): void {
  const key = keyOf(roomId);
  try {
    if (!broken) {
      const raw = store?.getItem(key);
      if (!raw || (JSON.parse(raw) as Partial<SavedLocalGame>).roomId !== roomId) return;
    }
    store?.removeItem(key);
  } catch {
    // ignore
  }
}
