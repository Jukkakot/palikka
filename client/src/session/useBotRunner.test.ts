// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { Placement } from "@palikka/rules";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOT_DELAY_MS, type AskBot } from "../bots/botMoves.ts";
import { gameView, seatView } from "../test/views.ts";
import { botTurnKey, useBotRunner, type GameRoomLike } from "@game-kit/client";
import { createPalikkaClient, palikkaClient } from "./palikkaClient.ts";
import type { GameView } from "./viewModel.ts";

const MOVE: Placement = { piece: 10, orientation: 0, row: 0, col: 15 };

/** Maija (seat 1) runs the bots; Kettu (seat 2) is on turn. */
const botTurn = (extra: Partial<GameView> = {}) =>
  gameView({
    seats: [seatView(1, "Maija"), seatView(2, "Kettu", { isBot: true, isMe: false })],
    turnSeat: 2,
    turnColour: 2,
    isMyTurn: false,
    turnBotPlayed: true,
    botRunnerSeat: 1,
    turn: 2,
    ...extra,
  });

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
  it("Runner moves for a bot: asks the bot, then sends botMove for the seat after the pause", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    const askBot = vi.fn<AskBot>(async () => MOVE);
    const ask = createPalikkaClient(askBot).askBot;
    renderHook(() => useBotRunner(room, botTurn(), ask));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 10);
    });
    expect(askBot).toHaveBeenCalledWith(expect.objectContaining({ colour: 2, budget: expect.objectContaining({ timeMs: expect.any(Number) }) }));
    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(request).toHaveBeenCalledExactlyOnceWith("botMove", { seat: 2, move: MOVE });
  });

  it("Bot plays the shared colour: asks for colour 4 from the bot seat's side, sends it for the seat", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    const askBot = vi.fn<AskBot>(async () => MOVE);
    const ask = createPalikkaClient(askBot).askBot;
    renderHook(() => useBotRunner(room, botTurn({ variant: "trio", turnColour: 4, turnShared: true }), ask));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    });
    expect(askBot).toHaveBeenCalledWith(expect.objectContaining({ colour: 4, viewpoint: 2 }));
    expect(request).toHaveBeenCalledExactlyOnceWith("botMove", { seat: 2, move: MOVE });
  });

  it("a turn that moves on first drops the answer", async () => {
    vi.useFakeTimers();
    const { room, request } = fakeRoom();
    let answer!: (move: Placement) => void;
    const askBot: AskBot = () => new Promise((resolve) => (answer = resolve));
    const ask = createPalikkaClient(askBot).askBot;
    const { rerender } = renderHook((view: GameView) => useBotRunner(room, view, ask), { initialProps: botTurn() });
    rerender(botTurn({ turn: 3, turnSeat: 1, turnBotPlayed: false, isMyTurn: true }));
    await act(async () => {
      answer(MOVE);
      await vi.advanceTimersByTimeAsync(2 * BOT_DELAY_MS);
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("the real bot answers here where no worker runs", async () => {
    // The search bot's time limit reads the real clock: only the pause is faked.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { room, request } = fakeRoom();
    renderHook(() => useBotRunner(room, botTurn(), palikkaClient.askBot));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOT_DELAY_MS);
    });
    expect(request).toHaveBeenCalledWith("botMove", { seat: 2, move: expect.objectContaining({ row: 0 }) });
  });
});
