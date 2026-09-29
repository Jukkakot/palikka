import type { KeyboardEvent } from "react";
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from "@tabler/icons-react";
import { INSERTIONS, insertionLine, type InsertionId } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import styles from "./ShiftTargets.module.css";
import { TILE_UNITS } from "./TileView.tsx";

/** The arrow points into the board, away from the side the spare enters from. */
const ARROWS = { N: IconArrowDown, S: IconArrowUp, W: IconArrowRight, E: IconArrowLeft } as const;
/** Arrow badge centre inside the entry tile: at its outer edge, where a corridor would lead off the board anyway. */
const BADGE = { N: [50, 17], S: [50, 83], W: [17, 50], E: [83, 50] } as const;
const BADGE_R = 14;
const ICON = 20;

export interface ShiftTargetsProps {
  /** The insertion being previewed. */
  selected?: InsertionId;
  /** The forbidden reverse of the previous shift: shown, but not selectable. */
  forbidden?: InsertionId;
  /** While a command waits for the server nothing is selectable. */
  busy?: boolean;
  onSelect(insertion: InsertionId): void;
}

/** Tap targets for the 12 insertion points: the whole entry tile, marked by an arrow at its outer edge. */
export function ShiftTargets({ selected, forbidden, busy = false, onSelect }: ShiftTargetsProps) {
  const { t } = useTranslation();
  return (
    <g>
      {INSERTIONS.map((id) => {
        const side = id[0] as keyof typeof ARROWS;
        const entry = insertionLine(id)[0]!;
        // People count lines from 1.
        const base = t(`shift.from${side}`, { line: Number(id.slice(1)) + 1 });
        const isForbidden = id === forbidden;
        const disabled = isForbidden || busy;
        const Arrow = ARROWS[side];
        const [cx, cy] = BADGE[side];
        const activate = () => {
          if (!disabled) onSelect(id);
        };
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          activate();
        };
        const cls = [styles.target, id === selected && styles.selected, isForbidden && styles.forbidden]
          .filter(Boolean)
          .join(" ");
        return (
          <g
            key={id}
            transform={`translate(${entry.col * TILE_UNITS} ${entry.row * TILE_UNITS})`}
            role="button"
            tabIndex={isForbidden ? -1 : 0}
            aria-label={isForbidden ? t("shift.forbidden", { label: base }) : base}
            aria-disabled={disabled || undefined}
            aria-pressed={id === selected}
            data-insertion={id}
            className={cls}
            onClick={activate}
            onKeyDown={onKeyDown}
          >
            <rect width={TILE_UNITS} height={TILE_UNITS} className={styles.hit} />
            <circle cx={cx} cy={cy} r={BADGE_R} className={styles.badge} />
            <Arrow
              x={cx - ICON / 2}
              y={cy - ICON / 2}
              width={ICON}
              height={ICON}
              size={ICON}
              stroke={2.5}
              className={styles.arrow}
            />
          </g>
        );
      })}
    </g>
  );
}
