import type { Schema } from "@colyseus/schema";
import type { GameRules, LogFields } from "@game-kit/protocol";
import type { z } from "zod";

/**
 * The server part of the game contract: the rules plus the wire. `C` is the game's synced child
 * schema (`state.game`); the kit creates it and never reads inside it.
 */
export interface GameServerDefinition<G, M, O, C extends Schema> {
  rules: GameRules<G, M, O>;
  /** Validates a `move` / `botMove` move; strict, so unknown fields are refused. */
  moveSchema: z.ZodType<M>;
  /** Validates the game's options in the join options and in `setOptions`; strict. */
  optionsSchema: z.ZodType<O>;
  /** The options of a room created without any (the join options' `options` are merged over them). */
  defaultOptions: O;
  /** The game's synced child schema. */
  Child: new () => C;
  /** The waiting room with `options`: the child shows an empty game (e.g. a board of the variant's size). */
  reset(options: O, child: C): void;
  /** Mirrors the started game into the child after every change. */
  sync(game: G, child: C): void;
  /**
   * The host changes the options in the waiting room. The kit has already refused a change that
   * leaves a person without a seat (TOO_MANY_PLAYERS); throw a `CommandRejection` to refuse more.
   */
  optionsChange?(from: O, to: O): void;
  /** Extra facts of the `turn.changed` line, e.g. the colours that are out. */
  turnLogFacts?(game: G): LogFields;
  /** The child's facts on rejected and failed command lines, e.g. the colour on turn. */
  stateFacts?(child: C): LogFields;
}
