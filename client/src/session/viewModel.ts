import { CLASSIC, PIECE_COUNT, PIECE_SIZES, scoreOf, type Position } from "@palikka/rules";

/** One colour of the started game as synced: its placed pieces and whether it is out or left. */
export interface SyncedColour {
  colour: number;
  /** Placed piece numbers in placement order. */
  pieces: Iterable<number>;
  out: boolean;
  left: boolean;
}

/** The synced state as the client receives it (Colyseus schema instances satisfy this shape). */
export interface SyncedState {
  /** Owner colour of every square (0 = empty), row-major. */
  cells?: Iterable<number>;
  /** The colours of the started game; empty in the waiting room. */
  colours?: Iterable<SyncedColour>;
  players?: {
    forEach(cb: (player: SyncedPlayer, sessionId: string) => void): void;
  };
  turnSeat?: number;
  phase?: string;
  /** Seat of the host; 0 until someone has joined. */
  hostSeat?: number;
  /** The winning seats once the game is over. */
  winners?: Iterable<number>;
  /** Turns started so far. */
  turn?: number;
  /** Server epoch ms when the current turn's time runs out; 0 = no clock. */
  turnDeadline?: number;
  turnExpired?: boolean;
  /** The seat whose browser computes the bots' moves; 0 = none. */
  botRunnerSeat?: number;
  /** How many spectators watch. */
  spectators?: number;
  /** Bot speed 1, 2 or 4. */
  botSpeed?: number;
  /** Id of the rematch game; "" until someone asked for one. */
  rematchRoomId?: string;
  /** Games against bots on the device only: "Peru" exists here. */
  undo?: boolean;
  /** Games against bots on the device only: there is a move to take back. */
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
  /** The rules' score: −1 per unplaced square, bonuses for placing everything. */
  score: number;
  /** Squares the colour has on the board. */
  squares: number;
  /** Pieces not yet placed. */
  piecesLeft: number;
  /** The colour cannot move any more. */
  out: boolean;
}

/** One colour's line in the result of a finished game. */
export interface ResultRow {
  seat: number;
  /** The player's nickname; empty for a colour whose player left (the name left with them). */
  name: string;
  isMe: boolean;
  isBot: boolean;
  score: number;
  squares: number;
  piecesLeft: number;
  /** The player left the game before the end. */
  left: boolean;
  winner: boolean;
  /** 1 for the best score; equal scores share a rank and the next rank skips (1, 1, 3). */
  rank: number;
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
  /** Owner colour per square (0 = empty), row-major. */
  board: readonly number[];
  /** The started game as the rules see it (for moves, hints and bots); undefined in the waiting room. */
  position?: Position;
  /** Seated players sorted by seat. */
  seats: SeatView[];
  mySeat?: number;
  /** Seat of the current player; 0 in the waiting room. */
  turnSeat: number;
  /** The viewer plays the current turn themselves (false while the bot plays their seat). */
  isMyTurn: boolean;
  /** The bot plays the viewer's seat. */
  myAutoplay: boolean;
  /** The viewer may hand their seat to the bot: seated in a running game. */
  canAutoplay: boolean;
  /** The current turn is an auto-played person's. */
  turnAutoplay: boolean;
  /** The winning seats once finished (several on a shared win); empty otherwise. */
  winners: readonly number[];
  finished: boolean;
  /** Server epoch ms when the current turn's time runs out; 0 while no clock runs. */
  turnDeadline: number;
  /** The current turn's time is up (the server decides). */
  turnExpired: boolean;
  /** The current player's connection has dropped. */
  turnDisconnected: boolean;
  /** The viewer may kick the current player: seated, not on turn, time up, game running. */
  canKick: boolean;
  /** Turns started so far; 0 when not known. */
  turn: number;
  /** The seat whose browser computes the bots' moves; 0 = none. */
  botRunnerSeat: number;
  /** The seat on turn is played by the bot (a bot, or an auto-played person). */
  turnBotPlayed: boolean;
  /** "Peru" exists in this game (against bots on the device). */
  canUndo: boolean;
  /** There is a move to take back. */
  undoable: boolean;
  /** Once finished: every colour of the game, best score first. Empty before the end. */
  results: ResultRow[];
}

/** The engine's position from the synced state; undefined before the game has started. */
function positionOf(state: SyncedState, cells: number[], ended: boolean, winners: number[]): Position | undefined {
  const colours = state.colours ? [...state.colours] : [];
  if (colours.length === 0) return undefined;
  const placed: Record<number, number[]> = {};
  const out: number[] = [];
  let moveNumber = 0;
  for (const c of colours) {
    placed[c.colour] = [...c.pieces];
    moveNumber += placed[c.colour]!.length;
    if (c.out) out.push(c.colour);
  }
  return {
    config: CLASSIC,
    colours: colours.map((c) => c.colour).sort((a, b) => a - b),
    cells,
    placed,
    out,
    turn: ended ? 0 : (state.turnSeat ?? 0),
    moveNumber,
    ended,
    aborted: ended && winners.length === 0,
  };
}

/**
 * Builds the immutable view of a game from synced state. Returns undefined until the board has
 * arrived (right after joining, the state is still empty until the first patch).
 */
export function toGameView(state: SyncedState, roomId: string, mySessionId: string): GameView | undefined {
  const board = state.cells ? [...state.cells] : [];
  if (board.length !== CLASSIC.size * CLASSIC.size) return undefined;

  const finished = state.phase === "finished";
  const winners = state.winners ? [...state.winners] : [];
  const position = positionOf(state, board, finished, winners);
  const seats: SeatView[] = [];
  state.players?.forEach((p, sessionId) => {
    if (p.seat <= 0) return;
    const isBot = p.bot === true;
    const autoplay = !isBot && p.autoplay === true;
    const pieces = position?.placed[p.seat] ?? [];
    seats.push({
      seat: p.seat,
      sessionId,
      name: p.name ?? "",
      connected: isBot || p.connected,
      isMe: sessionId === mySessionId,
      isBot,
      autoplay,
      score: position ? scoreOf(pieces) : 0,
      squares: squaresOf(pieces),
      piecesLeft: PIECE_COUNT - pieces.length,
      out: position?.out.includes(p.seat) ?? false,
    });
  });
  seats.sort((a, b) => a.seat - b.seat);
  const me = seats.find((s) => s.isMe);
  const mySeat = me?.seat;
  const turnSeat = state.turnSeat ?? 0;
  const phase: GamePhase = finished ? "finished" : state.phase === "waiting" ? "waiting" : "playing";
  const myAutoplay = me?.autoplay ?? false;
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
    position,
    seats,
    mySeat,
    turnSeat,
    isMyTurn: phase === "playing" && mySeat !== undefined && mySeat === turnSeat && !myAutoplay,
    myAutoplay,
    canAutoplay: phase === "playing" && me !== undefined,
    turnAutoplay: !finished && current?.autoplay === true,
    winners,
    finished,
    turnDeadline: finished ? 0 : (state.turnDeadline ?? 0),
    turnExpired,
    turnDisconnected: !finished && current !== undefined && !current.connected,
    canKick: turnExpired && mySeat !== undefined && current !== undefined && mySeat !== turnSeat,
    turn: state.turn ?? 0,
    botRunnerSeat: state.botRunnerSeat ?? 0,
    turnBotPlayed: phase === "playing" && current !== undefined && (current.isBot || current.autoplay === true),
    canUndo: (state.undo ?? false) && me !== undefined,
    undoable: (state.undoable ?? false) && phase === "playing",
    results: finished && position ? resultRows(position, state, seats, winners) : [],
  };
}

const squaresOf = (pieces: readonly number[]) => pieces.reduce((sum, piece) => sum + PIECE_SIZES[piece]!, 0);

/** The result table: every colour of the game ranked by score, with who won and who left. */
export function resultRows(position: Position, state: SyncedState, seats: readonly SeatView[], winners: readonly number[]): ResultRow[] {
  const left = new Set([...(state.colours ?? [])].filter((c) => c.left).map((c) => c.colour));
  const rows = position.colours.map((colour): Omit<ResultRow, "rank"> => {
    const pieces = position.placed[colour] ?? [];
    const seat = seats.find((s) => s.seat === colour);
    return {
      seat: colour,
      name: seat?.name ?? "",
      isMe: seat?.isMe ?? false,
      isBot: seat?.isBot ?? false,
      score: scoreOf(pieces),
      squares: squaresOf(pieces),
      piecesLeft: PIECE_COUNT - pieces.length,
      left: left.has(colour) || seat === undefined,
      winner: winners.includes(colour),
    };
  });
  rows.sort((a, b) => b.score - a.score || a.seat - b.seat);
  return rows.map((row) => ({ ...row, rank: 1 + rows.filter((other) => other.score > row.score).length }));
}
