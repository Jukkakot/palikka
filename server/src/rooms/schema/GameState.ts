import { schema, t, type SchemaType } from "@colyseus/schema";
import type { LobbyState } from "@game-kit/server";

/** One colour of the running game as the rules engine holds it; stays after its player left. */
export const ColourState = schema({
  /** 1–4. */
  colour: t.uint8().default(0),
  /** The seat that plays it (in Perus the colour itself); 0 for the shared colour, played in turn. */
  seat: t.uint8().default(0),
  /** Placed piece numbers (0–20) in placement order: they give the score (the last one counts too). */
  pieces: t.array("uint8"),
  /** The colour cannot move any more (stuck, all pieces placed, or left). */
  out: t.boolean().default(false),
  /** The colour's player left the running game: its squares stay, they cannot win. */
  left: t.boolean().default(false),
});
export type ColourState = SchemaType<typeof ColourState>;

/** Palikka's synced game data: `state.game` in the kit's lobby state. */
export const PalikkaGame = schema({
  /** The variant: "classic", "duo", "double" or "trio"; the host sets it in the waiting room. */
  variant: t.string().default("classic"),
  /** Owner colour of every square (0 = empty), row-major, board size × board size (20×20, Duo 14×14). */
  cells: t.array("uint8"),
  /** The colours of the started game in ascending order; empty in the waiting room. */
  colours: t.array(ColourState),
  /** The colour on turn (played by `turnSeat`); 0 in the waiting room. */
  turnColour: t.uint8().default(0),
});
export type PalikkaGame = SchemaType<typeof PalikkaGame>;

/** The whole synced state of a Palikka room. */
export type GameState = LobbyState<PalikkaGame>;
