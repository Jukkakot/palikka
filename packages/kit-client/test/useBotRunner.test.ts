// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOT_DELAY_MS } from "../src/session/localRoom.ts";
import { toLobbyView } from "../src/session/lobbyView.ts";
import type { GameRoomLike } from "../src/session/roomLike.ts";
import { botTurnKey, useBotRunner, type AskViewBot } from "../src/session/useBotRunner.ts";
import { syncedState, type ConnectFourView } from "./support/connectFour.ts";

/** Maija (seat 1) runs the bots; Kettu (seat 2, a bot) is on turn. */
function botTurn(extra: Partial<ConnectFourView> = {}): ConnectFourView {
  const state = syncedState({}, { turnSeat: 2, botRunnerSeat: 1, turn: 2 });
  state.players = new Map([
    ["me", { seat: 1, connected: true, name: "Maija" }],
    ["bot:2", { seat: 2, connected: true, name: "Kettu", bot: true }],
  ]);
  return { ...toLobbyView(state, "r", "me"), board: new Array<number>(42).fill(0), ...extra };
}

function fakeRoom() {
  const request = vi.fn(async () => ({ ok: true }));
  return { room: { request } as unknown as GameRoomLike, request };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("bot-seats › Who computes bot moves (client)", () => {
  it("only the runner's browser plays, only on a running bot turn", () => {
    expect(botTurnKey(botTurn())).toBe("2:2");
    expect(botTurnKey(botTurn({ botRunnerSeat: 3 }))).toBeUndefined();
    expect(botTurnKey(botTurn({ turnBotPlayed: false }))).toBeUndefined();
    expect(botTurnKey(botTurn({ phase: "finished", finished: true }))).toBeUndefined();
    expect(botTurnKey(botTurn({ mySeat: undefined, spectating: true }))).toBeUndefined();
  });
});

describe("bot-seats › Bot moves are validated (client side)", () => {
  it("Runner moves for a bot: asks the game's bot at once, then sends botMove for the seat after the pause", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    const askBot = vi.fn<AskViewBot<ConnectFourView, number>>(async () => 3);
    renderHook(() => useBotRunner(room, botTurn(), askBot));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 10);
    });
    expect(askBot).toHaveBeenCalledWith(expect.objectContaining({ turnSeat: 2 }), 1, expect.any(Number));
    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(request).toHaveBeenCalledExactlyOnceWith("botMove", { seat: 2, move: 3 });
  });

  it("at a watching speed the pause shrinks and the bot is asked with that speed", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    const askBot = vi.fn<AskViewBot<ConnectFourView, number>>(async () => 3);
    renderHook(() => useBotRunner(room, botTurn({ botSpeed: 4 }), askBot));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS / 4);
    });
    expect(askBot).toHaveBeenCalledWith(expect.anything(), 4, expect.any(Number));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("a turn that moves on first drops the answer", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    let answer!: (move: number) => void;
    const askBot: AskViewBot<ConnectFourView, number> = () => new Promise((resolve) => (answer = resolve));
    const { rerender } = renderHook((view: ConnectFourView) => useBotRunner(room, view, askBot), { initialProps: botTurn() });
    rerender(botTurn({ turn: 3, turnSeat: 1, turnBotPlayed: false, isMyTurn: true }));
    await act(async () => {
      answer(3);
      await vi.advanceTimersByTimeAsync(2 * BOT_DELAY_MS);
    });
    expect(request).not.toHaveBeenCalled();
  });
});
