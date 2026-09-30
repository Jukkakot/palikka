import { KitGameRoom, type GameServerDefinition } from "@game-kit/server";
import { moveSchema, optionsSchema } from "@palikka/protocol";
import { DEFAULT_OPTIONS, palikkaRules, variantOf, type Game, type PalikkaOptions, type Placement } from "@palikka/rules";
import { ColourState, PalikkaGame } from "./schema/GameState.js";

export { BOT_DELAY_MS, BOT_RUNNER_GRACE_MS, MAX_OPEN_GAMES } from "@game-kit/server";

/** An empty board of `size` × `size` squares. */
function resizeBoard(child: PalikkaGame, size: number): void {
  const cells = size * size;
  if (child.cells.length === cells) return;
  child.cells.clear();
  child.cells.push(...Array.from({ length: cells }, () => 0));
}

/** Palikka's server part of the game contract: the rules, the wire and the synced board. */
export const palikkaServer: GameServerDefinition<Game, Placement, PalikkaOptions, PalikkaGame> = {
  rules: palikkaRules,
  moveSchema,
  optionsSchema,
  defaultOptions: DEFAULT_OPTIONS,
  Child: PalikkaGame,

  reset({ variant }, child) {
    child.variant = variant;
    resizeBoard(child, variantOf(variant).board.size);
  },

  /** Mirrors the engine's game: squares, the colour on turn, and each colour's pieces and status. */
  sync({ position, left, control }, child) {
    position.cells.forEach((owner, i) => {
      if (child.cells[i] !== owner) child.cells[i] = owner;
    });
    if (child.colours.length === 0) {
      for (const colour of position.colours) child.colours.push(new ColourState({ colour, seat: control[colour] ?? 0 }));
    }
    for (const c of child.colours) {
      const pieces = position.placed[c.colour] ?? [];
      for (let i = c.pieces.length; i < pieces.length; i++) c.pieces.push(pieces[i]!);
      c.out = position.out.includes(c.colour);
      c.left = c.seat !== 0 && left.includes(c.seat);
    }
    if (!position.ended) child.turnColour = position.turn;
  },

  turnLogFacts: ({ position }) => ({ out: position.out.join(",") }),

  stateFacts: (child) => ({ turnColour: child.turnColour }),
};

/**
 * One Palikka game: a board and up to four seated players, on the kit's game room. It starts in the
 * waiting room, where players take seats; the host (the first to join) starts the game.
 */
export class GameRoom extends KitGameRoom<Game, Placement, PalikkaOptions, PalikkaGame> {
  constructor() {
    super(palikkaServer);
  }
}
