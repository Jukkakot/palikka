import type { ColyseusTestServer } from "@colyseus/testing";
import { expect } from "vitest";
import type { CommandResult } from "@game-kit/protocol";
import { connectFourRules, type ConnectFourGame } from "@game-kit/protocol/testing";
import type appConfig from "./app.js";
import type { ConnectFourRoom } from "./app.js";

/** The parts of an SDK room the room tests use. */
export interface TestClient {
  sessionId: string;
  roomId: string;
  state: unknown;
  request(type: string, payload: unknown): Promise<unknown>;
  leave(consented?: boolean): Promise<unknown>;
  onLeave(cb: (code: number) => void): unknown;
  connection: { close(code?: number): void };
  reconnection: { minUptime: number };
}

type Server = ColyseusTestServer<typeof appConfig>;

/** The test room, as the room tests reach into it. */
export type GameRoom = ConnectFourRoom;

export const NAMES = ["Maija", "Pekka", "Liisa", "Olli"] as const;

export interface GameOptions {
  /** Turn time limit in ms (default: the real 120 s). */
  turnMs?: number;
  /** Seat hold after a drop, in seconds (default: the real 300 s). */
  disconnectSeconds?: number;
  /** Extra join options for the room creation (pool, options). */
  create?: Record<string, unknown>;
  /**
   * How long the bot runner may take after the bot pause (default 0: the test clients never compute
   * bot moves, so the server's fallback plays bot turns right after the pause).
   */
  graceMs?: number;
}

/** A new game's waiting room with `players` seated (seats 1…n, seat 1 hosting), named after `NAMES`. */
export async function waitingRoom(colyseus: Server, players: number, options: GameOptions = {}) {
  const room = (await colyseus.createRoom("game", { nickname: NAMES[0], ...options.create })) as unknown as GameRoom;
  if (options.turnMs !== undefined) room.turnLimitMs = options.turnMs;
  if (options.disconnectSeconds !== undefined) room.disconnectLimitSeconds = options.disconnectSeconds;
  room.botRunnerGraceMs = options.graceMs ?? 0;
  const clients: TestClient[] = [];
  for (let i = 0; i < players; i++) clients.push(await join(colyseus, room, NAMES[i]!));
  const player = (i: number) => room.state.players.get(clients[i]!.sessionId)!;
  const seatOf = (i: number) => room.state.players.get(clients[i]!.sessionId)?.seat;
  return { room, clients, player, seatOf };
}

/** Seats one more player in `room` under `nickname`. */
export async function join(colyseus: Server, room: GameRoom, nickname: string): Promise<TestClient> {
  return (await colyseus.connectTo(room as never, { nickname })) as unknown as TestClient;
}

/** The running game as the room's rules hold it (undefined in the waiting room). */
export function gameOf(room: GameRoom): ConnectFourGame {
  return (room as unknown as { current: ConnectFourGame }).current;
}

/** Puts `game` into the room's running game, to set up a board without playing to it. */
export function setGame(room: GameRoom, game: ConnectFourGame): void {
  (room as unknown as { current: ConnectFourGame }).current = game;
}

/** A legal move for the seat on turn in the room's game (the first free column). */
export function legalMove(room: GameRoom): number {
  return connectFourRules.fallbackMove(gameOf(room))!;
}

/** The client makes a legal move for the seat on turn (a whole turn). */
export function placeFree(client: TestClient, room: GameRoom): Promise<CommandResult> {
  return client.request("move", { move: legalMove(room) }) as Promise<CommandResult>;
}

/** Makes the next start give the first turn to `startSeat` instead of the host. */
export function forceStartSeat(room: GameRoom, startSeat: number): void {
  room.adjustStart = (game) => ({ ...game, turn: startSeat });
}

/**
 * A started game: `players` seated in seats 1…n, the host (seat 1) has started it, and
 * `startSeat` (default seat 1) has the first turn.
 */
export async function startedGame(colyseus: Server, players: number, options: GameOptions & { startSeat?: number } = {}) {
  const game = await waitingRoom(colyseus, players, options);
  forceStartSeat(game.room, options.startSeat ?? 1);
  expect(await game.clients[0]!.request("start", {})).toEqual({ ok: true } satisfies CommandResult);
  return game;
}
