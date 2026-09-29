import { bestLine, bestMove, hintMove, hintTurn, insertionLine, sameSquare, tileAt, type BotTurn, type BotView, type Square } from "@labyrinth/rules";
import type { GameView } from "../session/viewModel.ts";

/**
 * What the viewer may know, as the bots see it: the board, every pawn, every player's public found
 * list and cards left, the last insertion and only the viewer's own target. Undefined without a
 * seat or before the own target has arrived.
 */
export function botViewOf(view: GameView): BotView | undefined {
  if (view.mySeat === undefined || view.myTarget === undefined) return undefined;
  return {
    board: view.board,
    seat: view.mySeat,
    seats: view.seats.map((s) => ({
      seat: s.seat,
      pawn: s.square,
      found: s.found.length,
      cardsLeft: Math.max(0, s.cards - s.found.length),
      foundTreasures: s.found,
    })),
    lastInsertion: view.lastInsertion,
    target: view.myTarget === "home" ? undefined : view.myTarget,
  };
}

/** How deep the puzzle hint searches for a best route; deeper takes seconds on a phone. */
const PUZZLE_HINT_TURNS = 2;

/** The daily puzzle's destination, when the viewer is in a puzzle. */
const puzzleTarget = (view: GameView) => (view.daily && view.myTarget !== undefined && view.myTarget !== "home" ? view.myTarget : undefined);

/**
 * The hinted whole turn on the viewer's own shift step; undefined otherwise. In the daily puzzle
 * it is the first step of a best route, when one is within reach of the search.
 */
export function shiftHint(view: GameView): BotTurn | undefined {
  if (!view.isMyTurn || view.step !== "shift") return undefined;
  const target = puzzleTarget(view);
  const me = view.seats.find((s) => s.isMe);
  if (target && me) {
    const line = bestLine(view.board, me.square, target, view.lastInsertion, PUZZLE_HINT_TURNS);
    if (line?.[0]) return line[0];
  }
  const bot = botViewOf(view);
  return bot && hintTurn(bot);
}

/**
 * The hinted square on the viewer's own move step; undefined otherwise. When the shift just made is
 * `earlier`'s (same insertion, inserted tile turned the same way), `earlier.to` is kept, so following
 * a hint never jumps to an equally good but different square.
 */
export function moveHint(view: GameView, earlier?: BotTurn): Square | undefined {
  if (!view.isMyTurn || view.step !== "move" || !view.reachable) return undefined;
  if (
    earlier &&
    view.lastInsertion === earlier.insertion &&
    tileAt(view.board, insertionLine(earlier.insertion)[0]!).rotation === earlier.rotation &&
    view.reachable.some((sq) => sameSquare(sq, earlier.to))
  ) {
    return earlier.to;
  }
  const target = puzzleTarget(view);
  const best = target && bestMove(view.board, view.reachable, target, view.lastInsertion, PUZZLE_HINT_TURNS);
  if (best) return best;
  const bot = botViewOf(view);
  return bot && view.lastInsertion ? hintMove(bot) : undefined;
}

/** Quarter turns clockwise from rotation `from` to rotation `to`. */
export const quarterTurns = (from: number, to: number) => (((to - from) / 90) % 4 + 4) % 4;
