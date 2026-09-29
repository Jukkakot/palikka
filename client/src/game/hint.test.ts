import { hintTurn, isReachable, setupBoard, shiftBoard, TREASURES, type Board } from "@labyrinth/rules";
import { describe, expect, it } from "vitest";
import { toGameView, type SyncedState } from "../session/viewModel.ts";
import { botViewOf, moveHint, quarterTurns, shiftHint } from "./hint.ts";

const [MINE, THEIRS, FOUND] = [TREASURES[0]!, TREASURES[1]!, TREASURES[2]!];

function gameView(opts: { board?: Board; turnSeat?: number; phase?: string; lastInsertion?: string; mine?: { row: number; col: number } } = {}) {
  const board = opts.board ?? setupBoard(7);
  const state: SyncedState = {
    squares: board.squares.map(({ id, rotation }) => ({ id, rotation })),
    spare: { id: board.spare.id, rotation: board.spare.rotation },
    players: new Map([
      ["me", { seat: 1, connected: true, ...(opts.mine ?? { row: 0, col: 0 }), cards: 12, found: [], target: MINE }],
      // A spectator-style target on the other player must never reach the hint.
      ["other", { seat: 2, connected: true, row: 0, col: 6, cards: 12, found: [FOUND], target: THEIRS }],
    ]),
    turnSeat: opts.turnSeat ?? 1,
    phase: opts.phase ?? "shift",
    lastInsertion: opts.lastInsertion ?? "",
  };
  return toGameView(state, "brave-otters-sing", "me")!;
}

describe("board-view › Hint (client)", () => {
  it("the bot view holds the own target, public found lists and cards left, never another target", () => {
    const bot = botViewOf(gameView())!;
    expect(bot.seat).toBe(1);
    expect(bot.target).toBe(MINE);
    expect(bot.seats).toEqual([
      { seat: 1, pawn: { row: 0, col: 0 }, found: 0, cardsLeft: 12, foundTreasures: [] },
      { seat: 2, pawn: { row: 0, col: 6 }, found: 1, cardsLeft: 11, foundTreasures: [FOUND] },
    ]);
    expect(JSON.stringify(bot)).not.toContain(THEIRS);
  });

  it("Not your turn: no hint", () => {
    expect(shiftHint(gameView({ turnSeat: 2 }))).toBeUndefined();
    expect(moveHint(gameView({ turnSeat: 2, phase: "move", lastInsertion: "N1" }))).toBeUndefined();
  });

  it("Following the hint: the move step keeps the hinted square", () => {
    const view = gameView();
    const turn = shiftHint(view)!;
    expect(turn).toEqual(hintTurn(botViewOf(view)!));
    const shifted = shiftBoard(view.board, turn.insertion, turn.rotation, [{ row: 0, col: 0 }]);
    const moveView = gameView({ board: shifted.board, phase: "move", lastInsertion: turn.insertion, mine: shifted.pawns[0]! });
    expect(moveHint(moveView, turn)).toEqual(turn.to);
    // Without the earlier hint it is still a reachable square.
    expect(isReachable(moveView.board, shifted.pawns[0]!, moveHint(moveView)!)).toBe(true);
  });

  it("quarter turns from one rotation to another", () => {
    expect(quarterTurns(0, 270)).toBe(3);
    expect(quarterTurns(270, 0)).toBe(1);
    expect(quarterTurns(90, 90)).toBe(0);
  });
});
