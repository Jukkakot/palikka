import { useEffect, useState } from "react";
import { sameSquare, type Board, type Square } from "@labyrinth/rules";
import type { SeatView } from "../session/viewModel.ts";
import { Pawn } from "./Pawn.tsx";
import { pawnMotion, prefersReducedMotion } from "./pawnMotion.ts";
import { TILE_UNITS } from "./TileView.tsx";

interface Shown {
  square: Square;
  /** Transition time to `square`; 0 = jump. */
  ms: number;
}

interface Walk {
  sessionId: string;
  /** Squares still to step onto after the first one. */
  rest: Square[];
  stepMs: number;
}

const squareKey = (sq: Square) => `${sq.row},${sq.col}`;

/**
 * The pawns on the board. When a pawn's square changes it walks there along
 * the corridors, rides its tile during a shift (the spare changed), or jumps
 * (wrap-around, no path, reduced motion). A newer change finishes a walk in
 * progress at once.
 */
export function PawnLayer({ seats, board }: { seats: SeatView[]; board: Board }) {
  const key = `${board.spare.id}|${seats.map((s) => `${s.sessionId}@${squareKey(s.square)}`).join(";")}`;
  const [seen, setSeen] = useState(() => ({ key, spare: board.spare.id, squares: new Map(seats.map((s) => [s.sessionId, s.square])) }));
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const [walks, setWalks] = useState<Walk[]>([]);

  // A pawn moved: start its motion from where it was last seen (adjusting state during render, not in an effect).
  if (seen.key !== key) {
    const shifted = seen.spare !== board.spare.id;
    const reduced = prefersReducedMotion();
    const next: Record<string, Shown> = {};
    const started: Walk[] = [];
    for (const { sessionId, square } of seats) {
      const from = seen.squares.get(sessionId);
      if (!from || sameSquare(from, square)) {
        next[sessionId] = { square, ms: 0 };
        continue;
      }
      const motion = pawnMotion(from, square, board, shifted, reduced);
      if (motion.kind === "walk") {
        next[sessionId] = { square: motion.path[1]!, ms: motion.stepMs };
        started.push({ sessionId, rest: motion.path.slice(2), stepMs: motion.stepMs });
      } else {
        next[sessionId] = { square, ms: motion.kind === "slide" ? motion.ms : 0 };
      }
    }
    setSeen({ key, spare: board.spare.id, squares: new Map(seats.map((s) => [s.sessionId, s.square])) });
    setShown(next);
    setWalks(started);
  }

  // The remaining steps of each walk; a newer change cancels them (its own state already holds the end squares).
  useEffect(() => {
    const timers = walks.flatMap(({ sessionId, rest, stepMs }) =>
      rest.map((step, i) =>
        setTimeout(() => setShown((cur) => ({ ...cur, [sessionId]: { square: step, ms: stepMs } })), (i + 1) * stepMs),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [walks]);

  const at = (s: SeatView) => shown[s.sessionId] ?? { square: s.square, ms: 0 };
  const perSquare = new Map<string, number>();
  for (const s of seats) perSquare.set(squareKey(at(s).square), (perSquare.get(squareKey(at(s).square)) ?? 0) + 1);

  return (
    <g>
      {seats.map((s) => {
        const { square, ms } = at(s);
        return (
          <Pawn
            key={s.sessionId}
            seat={s.seat}
            look={s.look}
            name={s.name}
            isMe={s.isMe}
            connected={s.connected}
            x={square.col * TILE_UNITS}
            y={square.row * TILE_UNITS}
            moveMs={ms}
            crowded={(perSquare.get(squareKey(square)) ?? 0) > 1}
          />
        );
      })}
    </g>
  );
}
