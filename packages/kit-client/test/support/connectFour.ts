import { BOT_NAMES, KIT_ERROR_CODES, type Seat } from "@game-kit/protocol";
import { COLUMNS, connectFourRules, ROWS, type ConnectFourGame, type ConnectFourMove, type ConnectFourOptions } from "@game-kit/protocol/testing";
import type { GameClientDefinition } from "../../src/definition.ts";
import type { ListingOptions } from "../../src/session/useOpenGames.ts";
import type { LobbyView, SyncedLobbyState } from "../../src/session/lobbyView.ts";

/** The test game's view: the lobby plus the board. */
export type ConnectFourView = LobbyView & { board: number[] };

/** The test game's synced data, as the kit's test server syncs it. */
export interface ConnectFourSynced {
  cells?: Iterable<number>;
  moves?: number;
}

const isGame = (value: unknown): value is ConnectFourGame => {
  const game = value as ConnectFourGame;
  return Array.isArray(game?.cells) && game.cells.length === COLUMNS * ROWS && Array.isArray(game.seats) && typeof game.turn === "number";
};

/** Asks the test game's bot: the first free column, answered at once. */
export type AskConnectFourBot = (game: ConnectFourGame) => Promise<ConnectFourMove | undefined>;
export const firstFreeColumn: AskConnectFourBot = async (game) => connectFourRules.fallbackMove(game);

/** The kit's test game on the client, with `askBot` standing in for a game's bot. */
export function connectFourClient(askBot: AskConnectFourBot = firstFreeColumn): GameClientDefinition<ConnectFourGame, ConnectFourMove, ConnectFourOptions, ConnectFourView> {
  return {
    rules: connectFourRules,
    defaultOptions: {},
    toView(state: SyncedLobbyState, lobby: LobbyView) {
      const board = [...((state.game as ConnectFourSynced | undefined)?.cells ?? [])];
      return board.length === COLUMNS * ROWS ? { ...lobby, board } : undefined;
    },
    askBot: async (view) => {
      const col = Array.from({ length: COLUMNS }, (_, c) => c).find((c) => view.board[c] === 0);
      return col;
    },
    local: {
      save: {
        key: "test.localGame",
        check(game) {
          if (!isGame(game)) throw new Error("Not a Connect Four game");
          return game;
        },
      },
      seats({ nickname, bots }): Seat[] {
        const botSeats = BOT_NAMES.slice(0, bots).map((name, i) => ({ seat: i + (nickname === undefined ? 1 : 2), name, bot: true }));
        return nickname === undefined ? botSeats : [{ seat: 1, name: nickname, bot: false }, ...botSeats];
      },
      parseMove: (payload) => (Number.isInteger(payload) ? (payload as number) : undefined),
      askBot: (game) => askBot(game),
      child: (game): ConnectFourSynced => ({ cells: game.cells, moves: game.moves }),
      turn: (game) => game.moves + 1,
      logFacts: (game) => ({ moves: game.moves }),
    },
  };
}

export const connectFour = connectFourClient();

/** The test game's error codes with a message. */
export const ERROR_CODES = [...KIT_ERROR_CODES, "COLUMN_FULL"] as const;

/** How the open-games list reads the test game's listing. */
export const connectFourListing: ListingOptions<ConnectFourOptions> = {
  options: (raw) => {
    const seats = (raw as { seats?: unknown } | undefined)?.seats;
    return seats === 2 || seats === 3 || seats === 4 ? { seats } : {};
  },
  maxSeats: (options) => connectFourRules.seatRange(options).max,
};

/** A running game's synced state, as the server sends it. */
export function syncedState(players: Record<string, number>, turn: Partial<SyncedLobbyState> = {}): SyncedLobbyState {
  return {
    turnSeat: 1,
    phase: "play",
    ...turn,
    game: { cells: new Array<number>(COLUMNS * ROWS).fill(0), moves: 0 } satisfies ConnectFourSynced,
    players: new Map(Object.entries(players).map(([id, seat]) => [id, { seat, connected: true }])),
  };
}
