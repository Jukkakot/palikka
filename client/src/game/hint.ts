import { botRngFor, cellIndex, chooseBotCell, type GameState } from "@palikka/rules";
import type { GameView } from "../session/viewModel.ts";

/**
 * "Vihje": the cell the bots would claim for the viewer now, as a board index; undefined when the
 * viewer is not on turn. Uses the same strategy and the same kind of seeded rng as the bots, so a
 * hint is stable within a turn.
 */
export function hintCell(view: Pick<GameView, "board" | "seats" | "mySeat" | "isMyTurn" | "turn" | "targets">): number | undefined {
  if (!view.isMyTurn || view.mySeat === undefined) return undefined;
  const game: Pick<GameState, "seed" | "turn"> = { seed: 0, turn: view.turn };
  const rng = botRngFor(game as GameState, view.mySeat);
  const cell = chooseBotCell(
    {
      board: view.board,
      seat: view.mySeat,
      seats: view.seats.map((s) => ({ seat: s.seat, placed: s.placed })),
      targets: view.targets.length > 0 ? view.targets : undefined,
    },
    rng,
  );
  return cellIndex(cell);
}
