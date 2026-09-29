import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { CommandResult, MovePayload, ShiftPayload } from "@labyrinth/protocol";
import { ALL_SQUARES, createBoard, isReachable, reachableSquares, sameSquare, tileSpec, type Rotation, type Square } from "@labyrinth/rules";
import appConfig from "../src/app.config.js";
import { configureLogger } from "../src/logging/logger.js";
import type { GameState, Player } from "../src/rooms/schema/GameState.js";
import { captureLogs } from "./support/captureLogs.js";
import { arrange, startedGame, type TestClient as Client } from "./support/game.js";

const boardOf = (state: GameState) => {
  const tile = (t: { id: number; rotation: number }) => ({ id: t.id, kind: tileSpec(t.id).kind, rotation: t.rotation as Rotation });
  return createBoard({ squares: [...state.squares].map(tile), spare: tile(state.spare) });
};
const squareOf = (p: Player): Square => ({ row: p.row, col: p.col });

const shift = (client: Client, payload: ShiftPayload) => client.request("shift", payload) as Promise<CommandResult>;
const move = (client: Client, payload: MovePayload) => client.request("move", payload) as Promise<CommandResult>;

describe("pawn-movement in a room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  let logs: ReturnType<typeof captureLogs>;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    configureLogger();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    logs = captureLogs();
  });

  const game = (players: number) => startedGame(colyseus, players);

  /** Puts seat 1's pawn on a square that has somewhere to go (the random board decides where that is). */
  function placeOnCorridor(room: Parameters<typeof arrange>[0], seat: number): Square[] {
    const board = boardOf(room.state);
    const from = ALL_SQUARES.find((sq) => reachableSquares(board, sq).length > 1)!;
    arrange(room, seat, { pawn: from });
    return reachableSquares(board, from);
  }

  describe("Pawn squares", () => {
    it("every seat starts on its corner", async () => {
      const { player } = await game(4);
      expect([0, 1, 2, 3].map((i) => squareOf(player(i)))).toEqual([
        { row: 0, col: 0 },
        { row: 0, col: 6 },
        { row: 6, col: 6 },
        { row: 6, col: 0 },
      ]);
    });

    it("Pawn rides a shift on the server, and every player sees it", async () => {
      const { room, clients, player } = await game(2);
      arrange(room, 2, { pawn: { row: 2, col: 3 } });
      expect(await shift(clients[0]!, { insertion: "N3", rotation: 0 })).toEqual({ ok: true });
      expect(squareOf(player(1))).toEqual({ row: 3, col: 3 });

      const seen = () => (clients[0]!.state as GameState).players.get(clients[1]!.sessionId);
      await vi.waitFor(() => expect(seen() && squareOf(seen()!)).toEqual({ row: 3, col: 3 }));
    });

    it("a pawn pushed off the board lands on the inserted tile", async () => {
      const { room, clients, player } = await game(2);
      arrange(room, 1, { pawn: { row: 6, col: 3 } });
      await shift(clients[0]!, { insertion: "N3", rotation: 0 });
      expect(squareOf(player(0))).toEqual({ row: 0, col: 3 });
    });

    it("Shared square", async () => {
      const { room, clients, player } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      const reach = placeOnCorridor(room, 1);
      const target = reach[1]!;
      arrange(room, 2, { pawn: { row: target.row, col: target.col } });

      expect(await move(clients[0]!, target)).toEqual({ ok: true });
      expect(squareOf(player(0))).toEqual(target);
      expect(squareOf(player(1))).toEqual(target);
    });
  });

  describe("Move step", () => {
    it("Move along a corridor", async () => {
      const { room, clients, player } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      const target = placeOnCorridor(room, 1).at(-1)!;

      expect(await move(clients[0]!, target)).toEqual({ ok: true });
      expect(squareOf(player(0))).toEqual(target);
      expect(room.state.turnSeat).toBe(2);
      expect(room.state.phase).toBe("shift");
      expect(logs.byEvt("cmd.accepted").at(-1)).toMatchObject({ cmd: "move", payload: target });
    });

    it("Stay", async () => {
      const { room, clients, player } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      const here = squareOf(player(0));

      expect(await move(clients[0]!, here)).toEqual({ ok: true });
      expect(squareOf(player(0))).toEqual(here);
      expect(room.state.turnSeat).toBe(2);
    });

    it("Unreachable target: UNREACHABLE, nothing changes, facts in the audit line", async () => {
      const { room, clients, player } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      const board = boardOf(room.state);
      const here = squareOf(player(0));
      const target = ALL_SQUARES.find((sq) => !isReachable(board, here, sq))!;

      expect(await move(clients[0]!, target)).toEqual({ ok: false, code: "UNREACHABLE" });
      expect(squareOf(player(0))).toEqual(here);
      expect(room.state.turnSeat).toBe(1);
      expect(room.state.phase).toBe("move");
      expect(logs.byEvt("cmd.rejected")[0]).toMatchObject({
        cmd: "move",
        code: "UNREACHABLE",
        phase: "move",
        turnSeat: 1,
        pawn: [here.row, here.col],
        to: [target.row, target.col],
      });
    });

    it("Move before shifting: WRONG_PHASE", async () => {
      const { room, clients, player } = await game(2);
      expect(await move(clients[0]!, squareOf(player(0)))).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(room.state.turnSeat).toBe(1);
      expect(room.state.phase).toBe("shift");
    });

    it("Second shift: WRONG_PHASE", async () => {
      const { room, clients } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      const spare = room.state.spare.id;

      expect(await shift(clients[0]!, { insertion: "N3", rotation: 0 })).toEqual({ ok: false, code: "WRONG_PHASE" });
      expect(room.state.spare.id).toBe(spare);
      expect(room.state.lastInsertion).toBe("N1");
    });

    it("Square outside the board: INVALID_COMMAND", async () => {
      const { room, clients } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      expect(await move(clients[0]!, { row: 7, col: 0 })).toEqual({ ok: false, code: "INVALID_COMMAND" });
      expect(room.state.phase).toBe("move");
    });

    it("the other player cannot move for you: NOT_YOUR_TURN", async () => {
      const { room, clients, player } = await game(2);
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      expect(await move(clients[1]!, squareOf(player(1)))).toEqual({ ok: false, code: "NOT_YOUR_TURN" });
      expect(room.state.turnSeat).toBe(1);
    });

    it("a stay after a wrapping shift uses the carried square", async () => {
      const { room, clients, player } = await game(2);
      arrange(room, 1, { pawn: { row: 6, col: 1 } });
      await shift(clients[0]!, { insertion: "N1", rotation: 0 });
      expect(sameSquare(squareOf(player(0)), { row: 0, col: 1 })).toBe(true);
      expect(await move(clients[0]!, { row: 0, col: 1 })).toEqual({ ok: true });
    });
  });
});
