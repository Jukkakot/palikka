import { useId } from "react";
import { BOARD_SIZE, isFixed, type Board as BoardModel, type Square } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import type { SeatView } from "../session/viewModel.ts";
import styles from "./Board.module.css";
import { MoveTargets, type MoveTargetsProps } from "./MoveTargets.tsx";
import { PawnLayer } from "./PawnLayer.tsx";
import { ShiftTargets, type ShiftTargetsProps } from "./ShiftTargets.tsx";
import { collectedTreasures, isCollected } from "./collected.ts";
import { targetOf, type TargetMark } from "./target.ts";
import { TILE_UNITS, TileView } from "./TileView.tsx";
import { HintMark, PushMark, ReachMarks, RouteTrace } from "./TurnMarks.tsx";
import type { TurnTrace } from "./turnTrace.ts";

const SIZE = BOARD_SIZE * TILE_UNITS;

export interface BoardProps {
  board: BoardModel;
  seats?: SeatView[];
  /** Insertion arrows on the edge tiles; only given on the viewer's own turn. */
  shiftTargets?: ShiftTargetsProps;
  /** Reachable squares to tap; only given on the viewer's own move step. */
  moveTargets?: MoveTargetsProps;
  /** Id of a tile to outline (the inserted spare in a preview). */
  highlightTileId?: number;
  /** The viewer's target, marked wherever its tile is. */
  target?: TargetMark;
  /** The last turn's marks: where the tile was pushed in and the walked route. */
  trace?: TurnTrace;
  /** Squares the viewer could reach after the previewed shift. */
  reach?: readonly Square[];
  /** The hinted square to walk to. */
  hint?: Square;
}

/** The 7×7 board as one scalable SVG, with the pawns on their squares and the controls of the current step. */
export function Board({ board, seats = [], shiftTargets, moveTargets, highlightTileId, target, trace, reach, hint }: BoardProps) {
  const { t } = useTranslation();
  const clipId = useId();
  const collected = collectedTreasures(seats);
  // The last turn's marks are drawn in the mover's pawn colour.
  const traceLook = trace?.seat === undefined ? undefined : (seats.find((s) => s.seat === trace.seat)?.look ?? trace.seat);
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.board} aria-label={t("board.label")} role="group">
      {/* Corridors open toward the board edge end at the tiles' outer edge instead of sticking out. */}
      <clipPath id={clipId}>
        <rect x={3} y={3} width={SIZE - 6} height={SIZE - 6} rx={10} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {board.squares.map((tile, i) => {
          const row = Math.floor(i / BOARD_SIZE);
          const col = i % BOARD_SIZE;
          return (
            <TileView
              key={tile.id}
              tile={tile}
              fixed={isFixed({ row, col })}
              x={col * TILE_UNITS}
              y={row * TILE_UNITS}
              highlight={tile.id === highlightTileId}
              target={targetOf(tile.id, target)}
              treasureHidden={isCollected(tile.id, collected)}
            />
          );
        })}
      </g>
      {trace?.insertion && traceLook !== undefined && <PushMark insertion={trace.insertion} look={traceLook} />}
      {trace?.route && traceLook !== undefined && <RouteTrace route={trace.route} look={traceLook} />}
      {reach && <ReachMarks squares={reach} />}
      {moveTargets && <MoveTargets {...moveTargets} />}
      {hint && <HintMark square={hint} />}
      {/* Pawns never catch taps: a move target under a pawn must stay tappable. */}
      <g className={styles.pawns}>
        <PawnLayer seats={seats} board={board} />
      </g>
      {shiftTargets && <ShiftTargets {...shiftTargets} />}
    </svg>
  );
}
