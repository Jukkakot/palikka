import { useId } from "react";
import type { Tile } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import styles from "./SpareTile.module.css";
import { isCollected, type Collected } from "./collected.ts";
import { targetOf, type TargetMark } from "./target.ts";
import { TILE_UNITS, TileView } from "./TileView.tsx";

export interface SpareTileProps {
  tile: Tile;
  /** Defaults to "spare tile". */
  caption?: string;
  /** The tile that would drop out in a preview: smaller and faded. */
  outgoing?: boolean;
  /** The viewer's target: marked when this is its tile. */
  target?: TargetMark;
  /** Collected treasures: not drawn on the tile. */
  collected?: Collected;
}

/** A tile off the board (the spare, or the one about to drop out), drawn exactly like a board tile, with its label. */
export function SpareTile({ tile, caption, outgoing = false, target, collected }: SpareTileProps) {
  const { t } = useTranslation();
  const clipId = useId();
  const label = caption ?? t("board.spare");
  return (
    <figure className={outgoing ? `${styles.spare} ${styles.outgoing}` : styles.spare}>
      <svg viewBox={`0 0 ${TILE_UNITS} ${TILE_UNITS}`} className={styles.tile} aria-label={label} role="group">
        <clipPath id={clipId}>
          <rect x={3} y={3} width={TILE_UNITS - 6} height={TILE_UNITS - 6} rx={10} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <TileView tile={tile} target={targetOf(tile.id, target)} treasureHidden={isCollected(tile.id, collected)} />
        </g>
      </svg>
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  );
}
