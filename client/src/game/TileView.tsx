import { IconFlag, IconHome } from "@tabler/icons-react";
import { openings, TILE_SET, type Direction, type Tile } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import styles from "./TileView.module.css";
import { TREASURE_ICONS } from "./treasureIcons.ts";

/** Tile drawing units: every tile is 100 × 100, the board 700 × 700. */
export const TILE_UNITS = 100;
const C = TILE_UNITS / 2;
const EDGE: Record<Direction, [number, number]> = { N: [C, 0], E: [TILE_UNITS, C], S: [C, TILE_UNITS], W: [0, C] };

export interface TileViewProps {
  tile: Tile;
  fixed?: boolean;
  /** Top-left corner in board units. */
  x?: number;
  y?: number;
  /** Outline marking the tile, e.g. the spare inserted in a shift preview. */
  highlight?: boolean;
  /** This tile is the viewer's target: a treasure to collect, or home. */
  target?: "treasure" | "home";
  /** The treasure is already collected: drawn as a plain tile. Ignored on a target tile. */
  treasureHidden?: boolean;
}

/**
 * One tile in the corridor style: plain tile, corridors from the centre to each open side, treasure icon.
 * Positioned with a CSS transform so a tile that moves (same key, new x/y) slides there.
 */
export function TileView({ tile, fixed = false, x = 0, y = 0, highlight = false, target, treasureHidden = false }: TileViewProps) {
  const { t } = useTranslation();
  const treasure = treasureHidden && !target ? undefined : TILE_SET[tile.id]?.treasure;
  const Icon = treasure ? TREASURE_ICONS[treasure] : undefined;
  const open = openings(tile);
  const name = treasure ? t(`treasures.${treasure}`) : undefined;
  const label =
    target === "home"
      ? t("board.targetHome")
      : name
        ? t(target ? "board.targetTreasure" : "board.treasure", { name })
        : undefined;
  const Badge = target === "home" ? IconHome : IconFlag;

  return (
    <g
      style={{ transform: `translate(${x}px, ${y}px)` }}
      className={styles.slide}
      data-tile-id={tile.id}
      data-openings={open.join("")}
      data-fixed={fixed || undefined}
      data-target={target}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x={3} y={3} width={94} height={94} rx={10} className={fixed ? styles.fixed : styles.tile} />
      {fixed && <path d="M3 13 A10 10 0 0 1 13 3 H27 L3 27 Z" className={styles.fixedMark} />}
      {open.map((dir) => (
        <line key={dir} x1={C} y1={C} x2={EDGE[dir][0]} y2={EDGE[dir][1]} className={styles.corridor} data-arm={dir} />
      ))}
      <circle cx={C} cy={C} r={15} className={styles.hub} />
      {Icon && <Icon x={33} y={33} width={34} height={34} size={34} stroke={2} className={styles.icon} />}
      {highlight && <rect x={6} y={6} width={88} height={88} rx={8} className={styles.highlight} data-highlight />}
      {target && (
        <g className={styles.target}>
          <rect x={9} y={9} width={82} height={82} rx={7} className={styles.targetRing} />
          <circle cx={80} cy={20} r={15} className={styles.targetBadge} />
          <Badge x={70} y={10} width={20} height={20} size={20} stroke={2.25} className={styles.targetIcon} />
        </g>
      )}
    </g>
  );
}
