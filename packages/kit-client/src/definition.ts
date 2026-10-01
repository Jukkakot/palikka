import type { BotSpeed, GameRules, LogFields, Seat } from "@game-kit/protocol";
import type { LocalSaveFormat } from "./session/localGameStore.ts";
import type { LobbyView, SyncedLobbyState } from "./session/lobbyView.ts";

/** What a device game is set up with: the player's name (none when only bots play), the bots and the options. */
export interface LocalSetup<O> {
  /** The player's nickname; undefined for a game of bots to watch. */
  nickname?: string;
  /** How many bots the player asked for (the options may set their own count). */
  bots: number;
  options: O;
}

/**
 * The client part of the game contract. `V` is the game's view: the kit's `LobbyView` plus what the
 * game shows (its board, pieces, scores …). No zod or Colyseus schema here: the client bundle stays small.
 */
export interface GameClientDefinition<G, M, O, V extends LobbyView> {
  rules: GameRules<G, M, O>;
  defaultOptions: O;
  /**
   * The game's view from the synced state (its own data under `state.game`) and the kit's lobby
   * view; undefined until the game's data has arrived (right after joining).
   */
  toView(state: SyncedLobbyState, lobby: LobbyView): V | undefined;
  /** Online bot runner: the move of the bot-played seat on turn in `view`, within the time of `speed`. */
  askBot(view: V, speed: BotSpeed, seed: number): Promise<M | undefined>;
  /** Games on the device. */
  local: {
    /** Where the device game is saved and how a saved game is checked. */
    save: LocalSaveFormat<G>;
    /** The seats of a new device game: the player in seat 1 (unless only bots play), then the bots. */
    seats(setup: LocalSetup<O>): Seat[];
    /** A move the player sent, checked for its shape (the rules check the rest); undefined when malformed. */
    parseMove(payload: unknown): M | undefined;
    /** The bot move for the seat on turn in `game`, within the time of `speed`. */
    askBot(game: G, speed: BotSpeed): Promise<M | undefined>;
    /** The game's synced data (`state.game`) as the server would sync it. */
    child(game: G): unknown;
    /** Turns started so far in `game` (the first turn is 1). */
    turn(game: G): number;
    /** Facts of the device game's start and end log lines, e.g. `{ dealSeed, moves }`. */
    logFacts?(game: G): LogFields;
  };
}
