import type { ColyseusTestServer } from "@colyseus/testing";
import { expect } from "vitest";
import type { CommandResult } from "@palikka/protocol";
import { decodeMove, legalMoves, type Game, type Placement } from "@palikka/rules";
import type appConfig from "../../src/app.config.js";
import type { GameRoom } from "../../src/rooms/GameRoom.js";

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

export const NAMES = ["Maija", "Pekka", "Liisa", "Olli"] as const;

export interface GameOptions {
  /** Turn time limit in ms (default: the real 120 s). */
  turnMs?: number;
  /** Seat hold after a drop, in seconds (default: the real 300 s). */
  disconnectSeconds?: number;
  /** Extra join options for the room creation (pool, private). */
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

/** The running game as the room's rules engine holds it (undefined in the waiting room). */
export function gameOf(room: GameRoom): Game {
  return (room as unknown as { game: Game }).game;
}

/** A legal move for the colour on turn in the room's game (the first one the engine lists). */
export function legalMove(room: GameRoom, seat = gameOf(room).position.turn): Placement {
  const { position } = gameOf(room);
  return decodeMove(legalMoves(position, seat)[0]!, position.config.size);
}

/** The client makes a legal move for the colour on turn (a whole turn). */
export function placeFree(client: TestClient, room: GameRoom): Promise<CommandResult> {
  return client.request("place", legalMove(room)) as Promise<CommandResult>;
}

/** Makes the next start give the first turn to `startSeat` instead of the host. */
export function forceStartSeat(room: GameRoom, startSeat: number): void {
  room.chooseStartSeat = () => startSeat;
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
