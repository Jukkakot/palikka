import { MIN_SEATS, type GameRules, type LogFields } from "@game-kit/protocol";
import { botRng, simpleBotMove } from "./bot.js";
import { endGame, playMove, removeSeat, seatOnTurn, startGame, type Game } from "./game.js";
import { placementText, type Placement } from "./moves.js";
import { scores } from "./scoring.js";
import { variantOf, type VariantId } from "./variants.js";

/*
 * Palikka's side of the game kit's contract: a thin wrapper over the match layer (`game.ts`), which
 * the server's room and the games on the device run. No rules live here.
 */

/** Palikka's game options: the variant (Perus when a client sends none). */
export interface PalikkaOptions {
  variant: VariantId;
}

export const DEFAULT_OPTIONS: PalikkaOptions = { variant: "classic" };

/** Each colour's score and squares for the end-of-game log line, e.g. "1:-12/77". */
export function scoreFacts(game: Game): string {
  return scores(game.position)
    .map((s) => `${s.colour}:${s.score}/${s.squares}`)
    .join(" ");
}

export const palikkaRules: GameRules<Game, Placement, PalikkaOptions> = {
  seatRange(options) {
    const variant = variantOf(options.variant);
    return { min: Math.max(MIN_SEATS, variant.minPlayers), max: variant.maxPlayers };
  },

  start: (seed, seats, options) => startGame(seed, seats, variantOf(options.variant).id),

  seatOnTurn,

  turnFacts: ({ position }): LogFields => ({ colour: position.turn, out: position.out.join(",") }),

  play(game, seat, move) {
    const result = playMove(game, seat, move);
    if (result.ok) return result;
    const facts: Partial<Record<typeof result.code, LogFields>> = {
      NOT_YOUR_TURN: { seat },
      WRONG_PHASE: { expected: "play" },
      NOT_SEATED: { seat },
    };
    return { ok: false, code: result.code, facts: facts[result.code] ?? { seat, move: placementText(move) } };
  },

  removeSeat,

  isOver: (game) => game.position.ended,

  winners: (game) => game.winners,

  end: endGame,

  fallbackMove({ position, seed }) {
    const colour = position.turn;
    return simpleBotMove(position, colour, botRng(seed, position, colour));
  },

  finishFacts: (game): LogFields => ({ scores: scoreFacts(game) }),

  moveText: placementText,
};
