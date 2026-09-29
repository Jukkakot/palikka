import { CELL_COUNT, cellsOf, type Board } from "@palikka/rules";
import { isDailyRoomId } from "./localGameStore.ts";

/** The synced state as the client receives it (Colyseus schema instances satisfy this shape). */
export interface SyncedState {
  /** Owner seat of every cell (0 = empty), row-major. */
  cells?: Iterable<number>;
  players?: {
    forEach(cb: (player: SyncedPlayer, sessionId: string) => void): void;
  };
  turnSeat?: number;
  phase?: string;
  /** Seat of the host; 0 until someone has joined. */
  hostSeat?: number;
  winnerSeat?: number;
  /** Turns started so far. */
  turn?: number;
  /** Server epoch ms when the current turn's time runs out; 0 = no clock. */
  turnDeadline?: number;
  turnExpired?: boolean;
  /** How many spectators watch. */
  spectators?: number;
  /** Bot speed 1, 2 or 4. */
  botSpeed?: number;
  /** Id of the rematch game; "" until someone asked for one. */
  rematchRoomId?: string;
  /** Daily puzzle: the cells to claim. */
  targets?: Iterable<number>;
  /** Daily puzzle: the fewest turns possible. */
  par?: number;
  /** Daily puzzle: there is a placement to take back. */
  undoable?: boolean;
}

export interface SyncedPlayer {
  seat: number;
  connected: boolean;
  /** True for a computer-controlled seat. */
  bot?: boolean;
  /** True while the bot plays this person's seat. */
  autoplay?: boolean;
  name?: string;
  /** Turns played. */
  placed?: number;
}

export interface SeatView {
  /** 1–4; also the seat's colour. */
  seat: number;
  sessionId: string;
  /** The player's nickname. */
  name: string;
  /** Always true for a bot. */
  connected: boolean;
  isMe: boolean;
  /** A computer-controlled seat (never the viewer, never the host). */
  isBot: boolean;
  /** A person's seat the bot plays for now (handed over, or the connection dropped). */
  autoplay?: boolean;
  /** Turns played. */
  placed: number;
  /** Cells the seat owns: its score. */
  score: number;
}

/** Where the game is: the waiting room before the start, the game itself, or finished. */
export type GamePhase = "waiting" | "playing" | "finished";

export interface GameView {
  roomId: string;
  phase: GamePhase;
  /** The viewer watches instead of playing (no seat). */
  spectating: boolean;
  /** How many spectators watch; 0 = nobody. */
  spectators: number;
  /** Bot speed 1, 2 or 4. */
  botSpeed: number;
  /** No person is seated: only bots play. */
  botOnly: boolean;
  /** The rematch game's id, once someone asked for one. */
  rematchRoomId?: string;
  /** Seat of the host, who may start the game from the waiting room; 0 until known. */
  hostSeat: number;
  board: Board;
  /** Seated players sorted by seat. */
  seats: SeatView[];
  mySeat?: number;
  /** Seat of the current player; 0 in the waiting room. */
  turnSeat: number;
  /** The viewer plays the current turn themselves (false while the bot plays their seat). */
  isMyTurn: boolean;
  /** The bot plays the viewer's seat. */
  myAutoplay: boolean;
  /** The viewer may hand their seat to the bot: seated in a running game that is not a daily puzzle. */
  canAutoplay: boolean;
  /** The current turn is an auto-played person's. */
  turnAutoplay: boolean;
  /** Seat of the winner; 0 while the game runs. */
  winnerSeat: number;
  finished: boolean;
  /** Server epoch ms when the current turn's time runs out; 0 while no clock runs. */
  turnDeadline: number;
  /** The current turn's time is up (the server decides). */
  turnExpired: boolean;
  /** The current player's connection has dropped. */
  turnDisconnected: boolean;
  /** The viewer may kick the current player: seated, not on turn, time up, game running. */
  canKick: boolean;
  /** A daily puzzle (solo, on the device). */
  daily: boolean;
  /** Turns started so far (the solving turn once finished); 0 when not known. */
  turn: number;
  /** Daily puzzle: the cells to claim; empty elsewhere. */
  targets: number[];
  /** Daily puzzle: the fewest turns possible; 0 elsewhere. */
  par: number;
  /** Daily puzzle: "Peru" can take back a placement. */
  undoable: boolean;
}

/**
 * Builds the immutable view of a game from synced state. Returns undefined until the board has
 * arrived (right after joining, the state is still empty until the first patch).
 */
export function toGameView(state: SyncedState, roomId: string, mySessionId: string): GameView | undefined {
  const board = state.cells ? [...state.cells] : [];
  if (board.length !== CELL_COUNT) return undefined;

  const seats: SeatView[] = [];
  state.players?.forEach((p, sessionId) => {
    if (p.seat <= 0) return;
    const isBot = p.bot === true;
    const autoplay = !isBot && p.autoplay === true;
    seats.push({
      seat: p.seat,
      sessionId,
      name: p.name ?? "",
      connected: isBot || p.connected,
      isMe: sessionId === mySessionId,
      isBot,
      autoplay,
      placed: p.placed ?? 0,
      score: cellsOf(board, p.seat),
    });
  });
  seats.sort((a, b) => a.seat - b.seat);
  const me = seats.find((s) => s.isMe);
  const mySeat = me?.seat;
  const turnSeat = state.turnSeat ?? 0;
  const finished = state.phase === "finished";
  const phase: GamePhase = finished ? "finished" : state.phase === "waiting" ? "waiting" : "playing";
  const myAutoplay = me?.autoplay ?? false;
  const daily = isDailyRoomId(roomId);
  const current = seats.find((s) => s.seat === turnSeat);
  const turnExpired = !finished && (state.turnExpired ?? false);
  return {
    roomId,
    phase,
    spectating: mySeat === undefined,
    spectators: state.spectators ?? 0,
    botSpeed: state.botSpeed || 1,
    botOnly: seats.length > 0 && seats.every((s) => s.isBot),
    rematchRoomId: state.rematchRoomId || undefined,
    hostSeat: state.hostSeat ?? 0,
    board,
    seats,
    mySeat,
    turnSeat,
    isMyTurn: phase === "playing" && mySeat !== undefined && mySeat === turnSeat && !myAutoplay,
    myAutoplay,
    canAutoplay: phase === "playing" && me !== undefined && !daily,
    turnAutoplay: !finished && current?.autoplay === true,
    winnerSeat: state.winnerSeat ?? 0,
    finished,
    turnDeadline: finished ? 0 : (state.turnDeadline ?? 0),
    turnExpired,
    turnDisconnected: !finished && current !== undefined && !current.connected,
    canKick: turnExpired && mySeat !== undefined && current !== undefined && mySeat !== turnSeat,
    daily,
    turn: state.turn ?? 0,
    targets: state.targets ? [...state.targets] : [],
    par: state.par ?? 0,
    undoable: state.undoable ?? false,
  };
}
