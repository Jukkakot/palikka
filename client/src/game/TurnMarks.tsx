import { BOARD_SIZE, type InsertionId, type Square } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import { TILE_UNITS } from "./TileView.tsx";
import styles from "./TurnMarks.module.css";

const hubOf = (sq: Square): [number, number] => [sq.col * TILE_UNITS + TILE_UNITS / 2, sq.row * TILE_UNITS + TILE_UNITS / 2];

/** The arrowhead's tip stops this far from the end hub, at the edge of the pawn standing there. */
const PAWN_GAP = 34;
const HEAD_LENGTH = 20;
const HEAD_HALF_WIDTH = 12;

/**
 * The last walked route in the mover's colour: a dashed line through the tile hubs, a small hollow
 * ring where it began and an arrowhead that ends at the pawn where it stopped.
 */
export function RouteTrace({ route, look }: { route: readonly Square[]; look: number }) {
  const start = route[0];
  if (!start || route.length < 2) return null;
  const colour = `var(--seat-${look})`;
  const hubs = route.map(hubOf);
  const [ex, ey] = hubs.at(-1)!;
  const [px, py] = hubs.at(-2)!;
  const length = Math.hypot(ex - px, ey - py);
  const [dx, dy] = [(ex - px) / length, (ey - py) / length];
  const tip: [number, number] = [ex - dx * PAWN_GAP, ey - dy * PAWN_GAP];
  const base: [number, number] = [tip[0] - dx * HEAD_LENGTH, tip[1] - dy * HEAD_LENGTH];
  const head = [
    tip,
    [base[0] - dy * HEAD_HALF_WIDTH, base[1] + dx * HEAD_HALF_WIDTH],
    [base[0] + dy * HEAD_HALF_WIDTH, base[1] - dx * HEAD_HALF_WIDTH],
  ];
  const line = [...hubs.slice(0, -1), base];
  return (
    <g className={styles.marks} aria-hidden data-route={route.map((sq) => `${sq.row},${sq.col}`).join(" ")}>
      <polyline points={line.join(" ")} className={styles.route} style={{ stroke: colour }} />
      <polygon points={head.join(" ")} className={styles.routeEnd} style={{ fill: colour }} data-route-end />
      <circle cx={hubs[0]![0]} cy={hubs[0]![1]} r={10} className={styles.routeStart} style={{ stroke: colour }} data-route-start />
    </g>
  );
}

/** Where each side's edge marker stands (the board edge) and how it is turned to point inward. */
const PUSH_SIDES = {
  N: (line: number) => ({ x: line * TILE_UNITS + TILE_UNITS / 2, y: 0, angle: 0 }),
  S: (line: number) => ({ x: line * TILE_UNITS + TILE_UNITS / 2, y: BOARD_SIZE * TILE_UNITS, angle: 180 }),
  W: (line: number) => ({ x: 0, y: line * TILE_UNITS + TILE_UNITS / 2, angle: -90 }),
  E: (line: number) => ({ x: BOARD_SIZE * TILE_UNITS, y: line * TILE_UNITS + TILE_UNITS / 2, angle: 90 }),
} as const;

/**
 * Where the last shift pushed the tile in: an arrowhead just outside the board edge, pointing into
 * the shifted line, in the colour of the player who shifted. It stands in the page gutter, so the
 * board keeps its size.
 */
export function PushMark({ insertion, look }: { insertion: InsertionId; look: number }) {
  const side = insertion[0] as keyof typeof PUSH_SIDES;
  const { x, y, angle } = PUSH_SIDES[side](Number(insertion.slice(1)));
  return (
    <g className={styles.marks} aria-hidden data-push={insertion} data-look={look}>
      <polygon
        points="-20,-27 20,-27 0,-4"
        transform={`translate(${x} ${y}) rotate(${angle})`}
        className={styles.push}
        style={{ fill: `var(--seat-${look})` }}
      />
    </g>
  );
}

/** The hinted square to walk to: a thick pulsing yellow ring on a dark halo, bigger than the reach rings; not tappable. */
export function HintMark({ square: sq }: { square: Square }) {
  const { t } = useTranslation();
  const cx = sq.col * TILE_UNITS + TILE_UNITS / 2;
  const cy = sq.row * TILE_UNITS + TILE_UNITS / 2;
  return (
    <g className={styles.marks} role="img" aria-label={t("hint.square", { row: sq.row + 1, col: sq.col + 1 })} data-hint={`${sq.row},${sq.col}`}>
      <circle cx={cx} cy={cy} r={33} className={styles.hintHalo} />
      <circle cx={cx} cy={cy} r={33} className={styles.hint} />
    </g>
  );
}

/** Squares the viewer could reach after the previewed shift: hollow rings on the hubs, not tappable. */
export function ReachMarks({ squares }: { squares: readonly Square[] }) {
  const { t } = useTranslation();
  return (
    <g className={styles.marks} role="img" aria-label={t("board.reach", { count: squares.length })}>
      {squares.map((sq) => (
        <circle
          key={`${sq.row},${sq.col}`}
          cx={sq.col * TILE_UNITS + TILE_UNITS / 2}
          cy={sq.row * TILE_UNITS + TILE_UNITS / 2}
          r={23}
          className={styles.reach}
          data-reach={`${sq.row},${sq.col}`}
        />
      ))}
    </g>
  );
}
