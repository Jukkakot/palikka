import type { GameClientDefinition, ListingOptions } from "@game-kit/client";
import { BOT_NAMES, type Seat } from "@game-kit/protocol";
import {
  botSeed,
  coloursOf,
  DEFAULT_OPTIONS,
  isVariantId,
  palikkaRules,
  PIECE_COUNT,
  variantOf,
  VARIANTS,
  type Game,
  type PalikkaOptions,
  type Placement,
  type VariantId,
} from "@palikka/rules";
import { botBudget, type AskBot } from "../bots/botMoves.ts";
import { askBotWorker } from "../bots/botWorkerClient.ts";
import { toView, type GameView, type SyncedGame } from "./viewModel.ts";

/** Bots in a device game of `variant`: the count asked for in Perus, else the variant's own. */
export function botCount(variant: VariantId, bots: number, watch = false): number {
  if (variant === "classic") return bots;
  return VARIANTS[variant].maxPlayers - (watch ? 0 : 1);
}

const isInt = (value: unknown, min: number, max: number): boolean => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/**
 * Throws unless `game` looks like a game of the current rules (an old or broken save is dropped).
 * Saves from before the variants (no variant, colour control or sides) are dropped too.
 */
export function checkGame(value: unknown): Game {
  const game = value as Game;
  const { position, seats } = game;
  const { size } = position.config;
  const ok =
    isVariantId(game.variant) &&
    typeof game.control === "object" &&
    game.control !== null &&
    typeof position.sides === "object" &&
    position.sides !== null &&
    Array.isArray(seats) &&
    Array.isArray(game.left) &&
    Array.isArray(game.winners) &&
    Array.isArray(position.colours) &&
    position.colours.every((c) => isInt(c, 1, 4) && Array.isArray(position.placed[c]) && position.placed[c]!.every((p) => isInt(p, 0, PIECE_COUNT - 1))) &&
    Array.isArray(position.cells) &&
    position.cells.length === size * size &&
    position.cells.every((owner) => isInt(owner, 0, 4)) &&
    Array.isArray(position.out);
  if (!ok) throw new Error("Not a saved game of the current rules");
  return game;
}

/** The `move` payload as a placement; undefined when a field is missing or not an integer. */
function placementOf(payload: unknown): Placement | undefined {
  const { piece, orientation, row, col } = (payload ?? {}) as Record<string, unknown>;
  const fields = [piece, orientation, row, col];
  return fields.every((f) => Number.isInteger(f)) ? ({ piece, orientation, row, col } as Placement) : undefined;
}

/** The game's synced data as the server's `sync` writes it, from the rules' game. */
function childOf(game: Game): SyncedGame {
  const { position } = game;
  return {
    variant: game.variant,
    cells: position.cells,
    colours: position.colours.map((colour) => {
      const seat = game.control[colour] ?? colour;
      return {
        colour,
        seat,
        pieces: position.placed[colour] ?? [],
        out: position.out.includes(colour),
        left: seat !== 0 && game.left.includes(seat),
      };
    }),
    turnColour: position.turn,
  };
}

/** The seats of a device game: the player in seat 1 and the bots after, or only bots from seat 1. */
function localSeats({ nickname, bots, options }: { nickname?: string; bots: number; options: PalikkaOptions }): Seat[] {
  const watch = nickname === undefined;
  const count = botCount(options.variant, bots, watch);
  const botSeats = BOT_NAMES.slice(0, count).map((name, i) => ({ seat: i + (watch ? 1 : 2), name, bot: true }));
  return watch ? botSeats : [{ seat: 1, name: nickname, bot: false }, ...botSeats];
}

/**
 * Palikka's client part of the game contract, with `askBot` as the source of bot moves (the bot
 * worker in the app, a stub in tests).
 */
export function createPalikkaClient(askBot: AskBot = askBotWorker): GameClientDefinition<Game, Placement, PalikkaOptions, GameView> {
  return {
    rules: palikkaRules,
    defaultOptions: DEFAULT_OPTIONS,
    toView,

    askBot(view, speed, seed) {
      const seat = view.turnSeat;
      const colour = view.turnColour || seat;
      // The shared colour is played for the seat whose turn it is to play it.
      const viewpoint = view.turnShared ? view.seats.find((s) => s.seat === seat)?.colours[0] : undefined;
      if (!view.position) return Promise.resolve(undefined);
      return askBot({ position: view.position, colour, budget: botBudget(speed), seed, ...(viewpoint !== undefined && { viewpoint }) });
    },

    local: {
      save: { key: "palikka.localGame", check: checkGame },
      seats: localSeats,
      parseMove: placementOf,
      askBot(game, speed) {
        const { position, seed } = game;
        const colour = position.turn;
        // The shared colour plays for the seat whose turn it is to play it.
        const viewpoint = game.control[colour] === 0 ? coloursOf(game, palikkaRules.seatOnTurn(game))[0] : undefined;
        return askBot({ position, colour, budget: botBudget(speed), seed: botSeed(seed, position.moveNumber, colour), ...(viewpoint !== undefined && { viewpoint }) });
      },
      child: childOf,
      turn: (game) => game.position.moveNumber + 1,
      logFacts: (game) => ({ dealSeed: game.seed, moves: game.position.moveNumber }),
    },
  };
}

/** Palikka's client definition with the bot worker. */
export const palikkaClient = createPalikkaClient();

/** How the open-games list reads a listing's options: the variant (Perus when unknown) and its seats. */
export const palikkaListing: ListingOptions<PalikkaOptions> = {
  options: (raw) => ({ variant: variantOf(typeof raw === "object" && raw !== null ? (raw as { variant?: unknown }).variant as string : undefined).id }),
  maxSeats: (options) => VARIANTS[options.variant].maxPlayers,
};
