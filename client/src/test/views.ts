import { CLASSIC, newPosition } from "@palikka/rules";
import type { GameView, SeatView } from "../session/viewModel.ts";

/** A seat for view tests: seat 1 is the viewer unless `extra` says otherwise. */
export function seatView(seat: number, name: string, extra: Partial<SeatView> = {}): SeatView {
  return { seat, sessionId: `s${seat}`, name, connected: true, isMe: seat === 1, isBot: false, score: -89, squares: 0, out: false, ...extra };
}

/** A running two-player game seen by seat 1 on turn, on an empty board; `extra` overrides any field. */
export function gameView(extra: Partial<GameView> = {}): GameView {
  const position = newPosition(CLASSIC, [1, 2], 1);
  return {
    roomId: "brave-otters-sing",
    phase: "playing",
    spectating: false,
    spectators: 0,
    botSpeed: 1,
    botOnly: false,
    hostSeat: 1,
    board: position.cells,
    position,
    seats: [seatView(1, "Maija"), seatView(2, "Pekka")],
    mySeat: 1,
    turnSeat: 1,
    isMyTurn: true,
    myAutoplay: false,
    canAutoplay: true,
    turnAutoplay: false,
    winners: [],
    finished: false,
    turnDeadline: 0,
    turnExpired: false,
    turnDisconnected: false,
    canKick: false,
    turn: 1,
    botRunnerSeat: 1,
    turnBotPlayed: false,
    canUndo: false,
    undoable: false,
    ...extra,
  };
}
