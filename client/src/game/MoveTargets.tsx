import type { KeyboardEvent } from "react";
import { sameSquare, type Square } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import styles from "./MoveTargets.module.css";
import { TILE_UNITS } from "./TileView.tsx";

export interface MoveTargetsProps {
  /** Squares the viewer's pawn can reach, its own square first. */
  reachable: readonly Square[];
  /** While a command waits for the server nothing is selectable. */
  busy?: boolean;
  /** Confirm move on: the square chosen and waiting for a second tap. */
  selected?: Square;
  onSelect(target: Square): void;
}

/** Tap targets for the move step: every reachable square outlined with a dot on its hub; the own square means stay. */
export function MoveTargets({ reachable, busy = false, selected, onSelect }: MoveTargetsProps) {
  const { t } = useTranslation();
  const own = reachable[0];
  return (
    <g>
      {reachable.map((sq) => {
        const isOwn = own !== undefined && sameSquare(sq, own);
        // People count rows and columns from 1.
        const label = isOwn ? t("move.stayHere") : t("move.to", { row: sq.row + 1, col: sq.col + 1 });
        const activate = () => {
          if (!busy) onSelect(sq);
        };
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          activate();
        };
        return (
          <g
            key={`${sq.row},${sq.col}`}
            transform={`translate(${sq.col * TILE_UNITS} ${sq.row * TILE_UNITS})`}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-disabled={busy || undefined}
            aria-pressed={selected ? sameSquare(sq, selected) : undefined}
            data-move-target={`${sq.row},${sq.col}`}
            className={styles.target}
            onClick={activate}
            onKeyDown={onKeyDown}
          >
            <rect width={TILE_UNITS} height={TILE_UNITS} className={styles.hit} />
            <rect x={8} y={8} width={84} height={84} rx={8} className={styles.outline} />
            <circle cx={50} cy={50} r={7} className={styles.dot} />
          </g>
        );
      })}
    </g>
  );
}
