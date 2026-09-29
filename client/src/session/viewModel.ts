import {
  createBoard,
  isInsertionId,
  reachableSquares,
  START_CORNERS,
  targetTileId,
  TILE_SET,
  TREASURES,
  type Board,
  type InsertionId,
  type Rotation,
  type Square,
  type TreasureId,
} from "@labyrinth/rules";
import { isDailyRoomId } from "./localGameStore.ts";

/** The synced state as the client receives it (Colyseus schema instances satisfy this shape). */
export interface SyncedState {
  squares?: Iterable<{ id: number; rotation: number }>;
  spare?: { id: number; rotation: number };
  players?: {
    forEach(cb: (player: SyncedPlayer, sessionId: string) => void): void;
  };
  turnSeat?: number;
  phase?: string;
  /** Seat of the host; 0 until someone has joined. */
  hostSeat?: number;
  lastInsertion?: string;
  winnerSeat?: number;
  /** Server epoch ms when the current turn's time runs out; 0 = no clock. */
  turnDeadline?: number;
  turnExpired?: boolean;
  /** How many spectators watch. */
  spectators?: number;
  /** Bot speed 1, 2 or 4. */
  botSpeed?: number;
  /** Id of the rematch game; "" until someone asked for one. */
  rematchRoomId?: string;
  /** Turns started so far; only games on the device report it. */
  turn?: number;
  /** Daily puzzle: the fewest turns possible. */
  par?: number;
  /** Daily puzzle: there is a shift to take back. */
  undoable?: boolean;
}

export interface SyncedPlayer {
  seat: number;
  /** The pawn 1–4; 0 or missing = the seat's own. */
  look?: number;
  connected: boolean;
  /** True for a computer-controlled seat. */
  bot?: boolean;
  /** True while the bot plays this person's seat. */
  autoplay?: boolean;
  name?: string;
  row?: number;
  col?: number;
  cards?: number;
  found?: Iterable<string>;
  /** Present for the viewer's own player, and for every player when spectating; "" = heading home. */
  target?: string;
}

/** The viewer's current target: a treasure, or their start corner once every card is found. */
export type Target = TreasureId | "home";

export interface SeatView {
  seat: number;
  /** The player's pawn 1–4 (colour + shape); missing = the seat's own. */
  look?: number;
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
  /** The square the pawn stands on. */
  square: Square;
  /** Size of the seat's treasure stack. */
  cards: number;
  /** Treasures found so far, in order. */
  found: TreasureId[];
  /** The seat's current target: the viewer's own, or every seat's for a spectator; else undefined. */
  target?: Target;
}

/** The step of the current turn: first a shift, then a move. */
export type TurnStep = "shift" | "move";

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
  step: TurnStep;
  /** On the viewer's own move step: every square their pawn can reach, its own square first. */
  reachable?: Square[];
  /** The previous shift, whose reverse is forbidden. */
  lastInsertion?: InsertionId;
  /** The viewer's own current target; undefined without a seat or before it has arrived. */
  myTarget?: Target;
  /**
   * Id of the highlighted target tile while the game runs: the viewer's own target's tile (or start
   * corner); for a spectator the current player's.
   */
  targetTileId?: number;
  /** The highlighted target is a start corner (heading home). */
  targetHome: boolean;
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
  /** Turns started so far (the winning turn once finished); 0 when not known. */
  turn: number;
  /** Daily puzzle: the fewest turns possible; 0 elsewhere. */
  par: number;
  /** Daily puzzle: "Peru" can take back a shift. */
  undoable: boolean;
}

const isTreasure = (value: unknown): value is TreasureId => (TREASURES as readonly unknown[]).includes(value);

const toTile = ({ id, rotation }: { id: number; rotation: number }) => ({
  id,
  kind: TILE_SET[id]!.kind,
  rotation: rotation as Rotation,
});

/**
 * Builds the immutable view of a game from synced state. Tile kinds come from
 * the static tile set; `createBoard` validates what the server sent. Returns
 * undefined until the board has arrived (right after joining, the state is
 * still empty until the first patch).
 */
export function toGameView(state: SyncedState, roomId: string, mySessionId: string): GameView | undefined {
  const squares = state.squares ? [...state.squares] : [];
  if (squares.length !== 49 || !state.spare) return undefined;

  const board = createBoard({ squares: squares.map(toTile), spare: toTile(state.spare) });
  const seats: SeatView[] = [];
  state.players?.forEach((p, sessionId) => {
    if (p.seat <= 0) return;
    const corner = START_CORNERS[p.seat - 1]!;
    const square = { row: p.row ?? corner.row, col: p.col ?? corner.col };
    const found = [...(p.found ?? [])].filter(isTreasure);
    const isMe = sessionId === mySessionId;
    // Only the viewer's own target arrives, or every one for a spectator.
    const target = readTarget(p.target, found.length, p.cards ?? 0);
    const isBot = p.bot === true;
    const autoplay = !isBot && p.autoplay === true;
    seats.push({ seat: p.seat, look: p.look || p.seat, sessionId, name: p.name ?? "", connected: isBot || p.connected, isMe, isBot, autoplay, square, cards: p.cards ?? 0, found, target });
  });
  seats.sort((a, b) => a.seat - b.seat);
  const mySeat = seats.find((s) => s.isMe)?.seat;
  const spectating = mySeat === undefined;
  const myTarget = seats.find((s) => s.isMe)?.target;
  const turnSeat = state.turnSeat ?? 0;
  const winnerSeat = state.winnerSeat ?? 0;
  const finished = state.phase === "finished";
  const phase: GamePhase = finished ? "finished" : state.phase === "waiting" ? "waiting" : "playing";
  const me = seats.find((s) => s.isMe);
  const myAutoplay = me?.autoplay ?? false;
  const isMyTurn = !finished && mySeat !== undefined && mySeat === turnSeat && !myAutoplay;
  const step: TurnStep = state.phase === "move" ? "move" : "shift";
  const daily = isDailyRoomId(roomId);
  const current = seats.find((s) => s.seat === turnSeat);
  const turnExpired = !finished && (state.turnExpired ?? false);
  // Whose target the board highlights: the viewer's own, or the current player's for a spectator.
  const focus = spectating ? current : me;
  const focusTarget = focus?.target;
  return {
    roomId,
    phase,
    spectating,
    spectators: state.spectators ?? 0,
    botSpeed: state.botSpeed || 1,
    botOnly: seats.length > 0 && seats.every((s) => s.isBot),
    rematchRoomId: state.rematchRoomId || undefined,
    hostSeat: state.hostSeat ?? 0,
    board,
    seats,
    mySeat,
    turnSeat,
    isMyTurn,
    myAutoplay,
    canAutoplay: phase === "playing" && me !== undefined && !daily,
    turnAutoplay: !finished && current?.autoplay === true,
    step,
    reachable: isMyTurn && step === "move" && me ? reachableSquares(board, me.square) : undefined,
    lastInsertion: isInsertionId(state.lastInsertion) ? state.lastInsertion : undefined,
    myTarget,
    targetTileId:
      !finished && focus !== undefined && focusTarget !== undefined
        ? targetTileId(focus.seat, focusTarget === "home" ? undefined : focusTarget)
        : undefined,
    targetHome: focusTarget === "home",
    winnerSeat,
    finished,
    turnDeadline: finished ? 0 : (state.turnDeadline ?? 0),
    turnExpired,
    turnDisconnected: !finished && current !== undefined && !current.connected,
    canKick: turnExpired && mySeat !== undefined && current !== undefined && mySeat !== turnSeat,
    daily,
    turn: state.turn ?? 0,
    par: state.par ?? 0,
    undoable: state.undoable ?? false,
  };
}

/** "" means heading home only once every card is found; before that it just has not arrived yet. */
function readTarget(target: string | undefined, found: number, cards: number): Target | undefined {
  if (isTreasure(target)) return target;
  return target === "" && cards > 0 && found >= cards ? "home" : undefined;
}
