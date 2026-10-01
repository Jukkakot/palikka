import { toLobbyView, type GamePhase, type LobbySeat, type LobbyView, type SyncedLobbyState, type SyncedPlayer } from "@game-kit/client";
import { PIECE_COUNT, PIECE_SIZES, scoreOf, variantOf, type Position, type VariantId } from "@palikka/rules";

export type { GamePhase, SyncedPlayer };

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

/** Palikka's synced game data (`state.game`) as the client receives it. */
export interface SyncedGame {
  /** "classic", "duo", "double" or "trio"; missing = Perus. */
  variant?: string;
  /** Owner colour of every square (0 = empty), row-major. */
  cells?: Iterable<number>;
  /** The colours of the started game; empty in the waiting room. */
  colours?: Iterable<SyncedColour>;
  /** The colour on turn (played by `turnSeat`); missing = the turn seat's colour (Perus). */
  turnColour?: number;
}

/** The synced state as the client receives it (Colyseus schema instances satisfy this shape). */
export type SyncedState = SyncedLobbyState & { game?: SyncedGame };

export interface SeatView extends LobbySeat {
  /** The colours the seat plays (not the shared colour), ascending; in the waiting room its own seat colour. */
  colours: number[];
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

/** What Palikka shows on top of the kit's lobby view: the variant, the board, colours and results. */
export interface PalikkaView {
  variant: VariantId;
  /** Squares per board side (20, Duo 14). */
  boardSize: number;
  /** Seats the variant has (4 in Perus). */
  maxSeats: number;
  /** Owner colour per square (0 = empty), row-major. */
  board: readonly number[];
  /** The started game as the rules see it (for moves, hints and bots); undefined in the waiting room. */
  position?: Position;
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
  /** Once finished: every colour of the game, best score first. Empty before the end. */
  results: ResultRow[];
}

/** Palikka's view: the kit's lobby view (with Palikka's seats) and what Palikka adds. */
export type GameView = LobbyView<SeatView> & PalikkaView;

/** The seat that plays a synced colour (0 = shared). */
const seatOfColour = (c: SyncedColour) => c.seat ?? c.colour;

/** The engine's position from the synced state; undefined before the game has started. */
function positionOf(game: SyncedGame, turnSeat: number, cells: number[], ended: boolean, winners: number[]): Position | undefined {
  const colours = game.colours ? [...game.colours] : [];
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
    config: variantOf(game.variant).board,
    colours: colours.map((c) => c.colour).sort((a, b) => a - b),
    sides,
    cells,
    placed,
    out,
    turn: ended ? 0 : (game.turnColour ?? turnSeat),
    moveNumber,
    ended,
    aborted: ended && winners.length === 0,
  };
}

/**
 * Palikka's view from the synced state and the kit's lobby view. Undefined until the board has
 * arrived (right after joining, the state is still empty until the first patch).
 */
export function toView(state: SyncedState, lobby: LobbyView): GameView | undefined {
  const game = state.game ?? {};
  const variant = variantOf(game.variant);
  const boardSize = variant.board.size;
  const board = game.cells ? [...game.cells] : [];
  if (board.length !== boardSize * boardSize) return undefined;

  const { finished, winners, turnSeat } = lobby;
  const position = positionOf(game, turnSeat, board, finished, [...winners]);
  const colourSeats = new Map([...(game.colours ?? [])].map((c) => [c.colour, seatOfColour(c)]));
  const seats: SeatView[] = lobby.seats.map((s) => {
    const colours = position ? position.colours.filter((c) => colourSeats.get(c) === s.seat) : [s.seat];
    const pieces = colours.map((c) => position?.placed[c] ?? []);
    return {
      ...s,
      colours,
      score: position ? sum(pieces.map(scoreOf)) : 0,
      squares: sum(pieces.map(squaresOf)),
      piecesLeft: sum(pieces.map((placed) => PIECE_COUNT - placed.length)),
      out: position !== undefined && colours.length > 0 && colours.every((c) => position.out.includes(c)),
    };
  });
  const me = seats.find((s) => s.isMe);
  const { mySeat } = lobby;
  const turnColour = finished || turnSeat === 0 ? 0 : (game.turnColour ?? turnSeat);
  const turnShared = turnColour !== 0 && colourSeats.get(turnColour) === 0;
  const myTurn = mySeat !== undefined && mySeat === turnSeat && turnColour !== 0;
  const myColours = me ? [...me.colours, ...(myTurn && turnShared ? [turnColour] : [])].sort((a, b) => a - b) : [];
  return {
    ...lobby,
    variant: variant.id,
    boardSize,
    maxSeats: variant.maxPlayers,
    board,
    position,
    seats,
    turnColour,
    turnShared,
    myColours,
    trayColour: me ? trayColourOf(me.colours, myTurn ? turnColour : 0, turnColour, position) : undefined,
    results: finished && position ? resultRows(position, game, seats, winners) : [],
  };
}

/** The whole view of a game from synced state: the kit's lobby view and Palikka's `toView`. */
export function toGameView(state: SyncedState, roomId: string, mySessionId: string): GameView | undefined {
  return toView(state, toLobbyView(state, roomId, mySessionId));
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
export function resultRows(position: Position, game: SyncedGame, seats: readonly SeatView[], winners: readonly number[]): ResultRow[] {
  const synced = [...(game.colours ?? [])];
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
