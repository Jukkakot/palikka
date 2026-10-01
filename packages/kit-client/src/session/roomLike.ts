import type { SyncedLobbyState } from "./lobbyView.ts";

/** The parts of a Colyseus SDK room the session uses (kept small for testing); a device game has the same. */
export interface GameRoomLike {
  roomId: string;
  sessionId: string;
  reconnectionToken: string;
  state: SyncedLobbyState;
  onStateChange(cb: (state: SyncedLobbyState) => void): unknown;
  onLeave(cb: (code: number) => void): unknown;
  onDrop(cb: () => void): unknown;
  onReconnect(cb: () => void): unknown;
  /** Sends a command; resolves with the server's `CommandResult`. */
  request(type: string, payload: unknown): Promise<unknown>;
  /** Leaves the game on purpose. */
  leave(): Promise<unknown>;
  /** Drops every listener (the SDK's `removeAllListeners`). */
  removeAllListeners(): void;
}
