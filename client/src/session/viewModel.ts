import { PIECE_COUNT, PIECE_SIZES, scoreOf, variantOf, type Position, type VariantId } from "@palikka/rules";

/** One colour of the started game as synced: its placed pieces and whether it is out or left. */
export interface SyncedColour {
  colour: number;
  /** The seat that plays it; 0 for the shared colour; missing = the colour itself (Perus). */
  seat?: number;
  /** Placed piece numbers in placement order. */
  pieces: Iterable<number>;
  out: boolean;
  left: boolean;
}

/** The synced state as the client receives it (Colyseus schema instances satisfy this shape). */
export interface SyncedState {
  /** "classic", "duo", "double" or "trio"; missing = Perus. */
  variant?: string;
  /** Owner colour of every square (0 = empty), row-major. */
  cells?: Iterable<number>;
  /** The colours of the started game; empty in the waiting room. */
  colours?: Iterable<SyncedColour>;
  players?: {
    forEach(cb: (player: SyncedPlayer, sessionId: string) => void): void;
  };
  turnSeat?: number;
  /** The colour on turn (played by `turnSeat`); missing = the turn seat's colour (Perus). */
  turnColour?: number;
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
  /** 1–4; in Perus also the seat's colour. */
  seat: number;
  /** The colours the seat plays (not the shared colour), ascending; in the waiting room its own seat colour. */
  colours: number[];
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
  /** The rules' score summed over the seat's colours: −1 per unplaced square, bonuses for placing everything. */
  score: number;
  /** Squares the seat's colours have on the board. */
  squares: number;
  /** Pieces not yet placed, over the seat's colours. */
  piecesLeft: number;
  /** None of the seat's colours can move any more. */
  out: boolean;
}

/** One player's line in the result of a finished game (or the shared colour's, which counts for no one). */
export interface ResultRow {
  /** The player's seat; 0 for the shared colour's row. */
  seat: number;
  /** The colours the row sums up. */
  colours: number[];
  /** The shared colour: not counted, no rank, never a winner. */
  shared: boolean;
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
  /** 1 for the best score; equal scores share a rank and the next rank skips (1, 1, 3); 0 for the shared colour. */
  rank: number;
}

/** Where the game is: the waiting room before the start, the game itself, or finished. */
export type GamePhase = "waiting" | "playing" | "finished";

export interface GameView {
  roomId: string;
  phase: GamePhase;
  variant: VariantId;
  /** Squares per board side (20, Duo 14). */
  boardSize: number;
  /** Seats the variant has (4 in Perus). */
  maxSeats: number;
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
  /** Seat of the player who plays the turn; 0 in the waiting room. */
  turnSeat: number;
  /** The colour on turn; 0 in the waiting room and once finished. */
  turnColour: number;
  /** The colour on turn is the shared colour (Kolmikko). */
  turnShared: boolean;
  /** The colours the viewer plays (the shared colour too while it is theirs to play); empty for a spectator. */
  myColours: number[];
  /**
   * The colour the viewer's tray shows and places: the turn colour when the viewer plays it now,
   * else their own colour next in turn order (not out), else their first colour; undefined for a spectator.
   */
  trayColour?: number;
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

/** The seat that plays a synced colour (0 = shared). */
const seatOfColour = (c: SyncedColour) => c.seat ?? c.colour;

/** The engine's position from the synced state; undefined before the game has started. */
function positionOf(state: SyncedState, cells: number[], ended: boolean, winners: number[]): Position | undefined {
  const colours = state.colours ? [...state.colours] : [];
  if (colours.length === 0) return undefined;
  const placed: Record<number, number[]> = {};
  const sides: Record<number, number> = {};
  const out: number[] = [];
  let moveNumber = 0;
  for (const c of colours) {
    placed[c.colour] = [...c.pieces];
    sides[c.colour] = seatOfColour(c);
    moveNumber += placed[c.colour]!.length;
    if (c.out) out.push(c.colour);
  }
  return {
    config: variantOf(state.variant).board,
    colours: colours.map((c) => c.colour).sort((a, b) => a - b),
    sides,
    cells,
    placed,
    out,
    turn: ended ? 0 : (state.turnColour ?? state.turnSeat ?? 0),
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
  const variant = variantOf(state.variant);
  const boardSize = variant.board.size;
  const board = state.cells ? [...state.cells] : [];
  if (board.length !== boardSize * boardSize) return undefined;

  const finished = state.phase === "finished";
  const winners = state.winners ? [...state.winners] : [];
  const position = positionOf(state, board, finished, winners);
  const colourSeats = new Map([...(state.colours ?? [])].map((c) => [c.colour, seatOfColour(c)]));
  const seats: SeatView[] = [];
  state.players?.forEach((p, sessionId) => {
    if (p.seat <= 0) return;
    const isBot = p.bot === true;
    const autoplay = !isBot && p.autoplay === true;
    const colours = position ? position.colours.filter((c) => colourSeats.get(c) === p.seat) : [p.seat];
    const pieces = colours.map((c) => position?.placed[c] ?? []);
    seats.push({
      seat: p.seat,
      colours,
      sessionId,
      name: p.name ?? "",
      connected: isBot || p.connected,
      isMe: sessionId === mySessionId,
      isBot,
      autoplay,
      score: position ? sum(pieces.map(scoreOf)) : 0,
      squares: sum(pieces.map(squaresOf)),
      piecesLeft: sum(pieces.map((placed) => PIECE_COUNT - placed.length)),
      out: position !== undefined && colours.length > 0 && colours.every((c) => position.out.includes(c)),
    });
  });
  seats.sort((a, b) => a.seat - b.seat);
  const me = seats.find((s) => s.isMe);
  const mySeat = me?.seat;
  const turnSeat = state.turnSeat ?? 0;
  const turnColour = finished || turnSeat === 0 ? 0 : (state.turnColour ?? turnSeat);
  const turnShared = turnColour !== 0 && colourSeats.get(turnColour) === 0;
  const myTurn = mySeat !== undefined && mySeat === turnSeat && turnColour !== 0;
  const myColours = me ? [...me.colours, ...(myTurn && turnShared ? [turnColour] : [])].sort((a, b) => a - b) : [];
  const phase: GamePhase = finished ? "finished" : state.phase === "waiting" ? "waiting" : "playing";
  const myAutoplay = me?.autoplay ?? false;
  const current = seats.find((s) => s.seat === turnSeat);
  const turnExpired = !finished && (state.turnExpired ?? false);
  return {
    roomId,
    phase,
    variant: variant.id,
    boardSize,
    maxSeats: variant.maxPlayers,
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
    turnColour,
    turnShared,
    myColours,
    trayColour: me ? trayColourOf(me.colours, myTurn ? turnColour : 0, turnColour, position) : undefined,
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

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const squaresOf = (pieces: readonly number[]) => sum(pieces.map((piece) => PIECE_SIZES[piece]!));

/**
 * The tray's colour: `playing` when the viewer plays the turn now, else the first of `own` after the
 * turn colour in turn order that is not out, else the first of `own`.
 */
function trayColourOf(own: readonly number[], playing: number, turnColour: number, position: Position | undefined): number | undefined {
  if (playing !== 0) return playing;
  if (own.length === 0) return undefined;
  if (!position || own.length === 1) return own[0];
  const { colours, out } = position;
  const from = Math.max(0, colours.indexOf(turnColour));
  for (let step = 1; step <= colours.length; step++) {
    const colour = colours[(from + step) % colours.length]!;
    if (own.includes(colour) && !out.includes(colour)) return colour;
  }
  return own[0];
}

/**
 * The result table: every player of the game (their colours summed) ranked by score, with who won
 * and who left; the shared colour last, not counted and without a rank.
 */
export function resultRows(position: Position, state: SyncedState, seats: readonly SeatView[], winners: readonly number[]): ResultRow[] {
  const synced = [...(state.colours ?? [])];
  const seatOf = (colour: number) => {
    const c = synced.find((s) => s.colour === colour);
    return c ? seatOfColour(c) : colour;
  };
  const leftSeats = new Set(synced.filter((c) => c.left).map(seatOfColour));
  const bySeat = new Map<number, number[]>();
  for (const colour of position.colours) bySeat.set(seatOf(colour), [...(bySeat.get(seatOf(colour)) ?? []), colour]);
  const summed = (colours: readonly number[]) => {
    const pieces = colours.map((c) => position.placed[c] ?? []);
    return {
      score: sum(pieces.map(scoreOf)),
      squares: sum(pieces.map(squaresOf)),
      piecesLeft: sum(pieces.map((p) => PIECE_COUNT - p.length)),
    };
  };
  const rows = [...bySeat.entries()]
    .filter(([seatNumber]) => seatNumber !== 0)
    .map(([seatNumber, colours]): Omit<ResultRow, "rank"> => {
      const seat = seats.find((s) => s.seat === seatNumber);
      return {
        seat: seatNumber,
        colours,
        shared: false,
        name: seat?.name ?? "",
        isMe: seat?.isMe ?? false,
        isBot: seat?.isBot ?? false,
        ...summed(colours),
        left: leftSeats.has(seatNumber) || seat === undefined,
        winner: winners.includes(seatNumber),
      };
    });
  rows.sort((a, b) => b.score - a.score || a.seat - b.seat);
  const ranked = rows.map((row) => ({ ...row, rank: 1 + rows.filter((other) => other.score > row.score).length }));
  const shared = (bySeat.get(0) ?? []).map(
    (colour): ResultRow => ({
      seat: 0,
      colours: [colour],
      shared: true,
      name: "",
      isMe: false,
      isBot: false,
      ...summed([colour]),
      left: false,
      winner: false,
      rank: 0,
    }),
  );
  return [...ranked, ...shared];
}
