import { KIT_CLIENT_KEY_EVENTS } from "@game-kit/protocol";

/** What a game tells the kit's client once, before it runs (see `configureKit`). */
export interface KitClientConfig {
  /** Prefix of the browser storage keys, e.g. "palikka" → `palikka.nickname`. */
  storagePrefix: string;
  /** The game server's base URL; resolved on use, so a build without one still loads. */
  serverUrl: () => string;
  /** This client's build version for the log lines. */
  clientVersion: () => string;
  /** Client log events shipped at info level even when not in debug mode (the kit's and the game's). */
  keyEvents: readonly string[];
}

let config: KitClientConfig = {
  storagePrefix: "game",
  serverUrl: () => "http://localhost:2567",
  clientVersion: () => "dev",
  keyEvents: KIT_CLIENT_KEY_EVENTS,
};

/**
 * Sets the game's client configuration. The kit reads it on use, never at import time, so the game
 * may call this after importing the kit (first thing in its entry, and in its test setup).
 */
export function configureKit(next: Partial<KitClientConfig>): void {
  config = { ...config, ...next };
}

export function kitConfig(): KitClientConfig {
  return config;
}

/** The storage key `name` of this game, e.g. `palikka.nickname`. */
export const storageKey = (name: string): string => `${config.storagePrefix}.${name}`;
