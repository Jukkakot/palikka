import { IconCalendarStar } from "@tabler/icons-react";
import type { Rotation, Tile, TileKind } from "@labyrinth/rules";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pawn } from "../game/Pawn.tsx";
import { TILE_UNITS, TileView, type TileViewProps } from "../game/TileView.tsx";
import { BackButton } from "../ui/BackButton.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { Screen } from "../ui/Screen.tsx";
import styles from "./HowToPlay.module.css";

const U = TILE_UNITS;

/** An example tile at column `col`, row `row` of a picture; ids are real tile ids, so treasures show. */
interface Cell extends Omit<TileViewProps, "tile" | "x" | "y"> {
  id: number;
  kind: TileKind;
  rotation: Rotation;
  col: number;
  row?: number;
}

function tiles(cells: readonly Cell[]) {
  return cells.map(({ id, kind, rotation, col, row = 0, ...rest }) => {
    const tile: Tile = { id, kind, rotation };
    return <TileView key={`${col}-${row}`} tile={tile} x={col * U} y={row * U} {...rest} />;
  });
}

/** A decorative picture: the text next to it carries the meaning, so assistive technology skips it. */
function Picture({ cols, rows = 1, children }: { cols: number; rows?: number; children: ReactNode }) {
  return (
    <svg
      className={styles.picture}
      viewBox={`-10 -10 ${cols * U + 20} ${rows * U + 20}`}
      style={{ maxWidth: `${(cols * U + 20) * 0.7}px` }}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** An arrow from (x1, y) to (x2, y), for a tile sliding in or out. */
function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g className={styles.arrow}>
      <line x1={x1} y1={y} x2={x2 - 12} y2={y} />
      <path d={`M${x2 - 16} ${y - 12} L${x2} ${y} L${x2 - 16} ${y + 12} Z`} />
    </g>
  );
}

/** The goal: from home, along a corridor, to the target treasure. */
function GoalPicture() {
  return (
    <Picture cols={3}>
      {tiles([
        { id: 0, kind: "corner", rotation: 90, col: 0, fixed: true },
        { id: 16, kind: "straight", rotation: 90, col: 1 },
        { id: 28, kind: "corner", rotation: 180, col: 2, target: "treasure" },
      ])}
      <Pawn seat={1} isMe />
    </Picture>
  );
}

/** Push: the spare slides into a row, and the tile at the far end drops out as the next spare. */
function PushPicture() {
  return (
    <Picture cols={5.8}>
      {tiles([{ id: 44, kind: "tee", rotation: 90, col: 0, highlight: true }])}
      <Arrow x1={105} x2={135} y={50} />
      <g transform="translate(40 0)">
        {tiles([
          { id: 17, kind: "straight", rotation: 90, col: 1 },
          { id: 29, kind: "corner", rotation: 0, col: 2 },
          { id: 45, kind: "tee", rotation: 180, col: 3 },
        ])}
      </g>
      <Arrow x1={445} x2={475} y={50} />
      <g opacity={0.45}>{tiles([{ id: 34, kind: "corner", rotation: 270, col: 4.8 }])}</g>
    </Picture>
  );
}

/** Squares the pawn at the top left can reach in the walk picture: all but the centre. */
const WALK_REACH: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2],
];

/** Walk: open corridors lead everywhere but the closed-off centre. */
function WalkPicture() {
  return (
    <Picture cols={3} rows={3}>
      {tiles([
        { id: 0, kind: "corner", rotation: 90, col: 0, row: 0, fixed: true },
        { id: 46, kind: "tee", rotation: 0, col: 1, row: 0 },
        { id: 35, kind: "corner", rotation: 180, col: 2, row: 0 },
        { id: 18, kind: "straight", rotation: 0, col: 0, row: 1 },
        { id: 19, kind: "straight", rotation: 90, col: 1, row: 1 },
        { id: 20, kind: "straight", rotation: 0, col: 2, row: 1 },
        { id: 36, kind: "corner", rotation: 0, col: 0, row: 2 },
        { id: 21, kind: "straight", rotation: 90, col: 1, row: 2 },
        { id: 37, kind: "corner", rotation: 270, col: 2, row: 2 },
      ])}
      {WALK_REACH.map(([c, r]) => (
        <g key={`${c}-${r}`} className={styles.reach} transform={`translate(${c * U} ${r * U})`}>
          <rect x={8} y={8} width={84} height={84} rx={8} />
          <circle cx={50} cy={50} r={8} />
        </g>
      ))}
      <Pawn seat={1} isMe />
    </Picture>
  );
}

/** Treasures: the pawn stops on its target's tile. */
function TreasurePicture() {
  return (
    <Picture cols={2}>
      {tiles([
        { id: 22, kind: "straight", rotation: 90, col: 0 },
        { id: 30, kind: "corner", rotation: 180, col: 1, target: "treasure" },
      ])}
      <Pawn seat={1} isMe x={U} />
    </Picture>
  );
}

/** Home: with every treasure found, back to the start corner. */
function HomePicture() {
  return (
    <Picture cols={2}>
      {tiles([
        { id: 23, kind: "straight", rotation: 90, col: 0 },
        { id: 3, kind: "corner", rotation: 180, col: 1, fixed: true, target: "home" },
      ])}
      <Pawn seat={1} isMe />
    </Picture>
  );
}

function Section({ id, picture, children }: { id: string; picture?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby={`howto-${id}`}>
      <h2 id={`howto-${id}`} className={styles.heading}>
        {t(`howTo.${id}.title` as "howTo.goal.title")}
      </h2>
      {picture}
      {children}
    </section>
  );
}

/**
 * "Näin pelaat": the rules in short sections (goal, push, walk, treasures, home, daily puzzle),
 * each with a picture drawn with the game's own tiles and pawns.
 */
export function HowToPlay({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  return (
    <Screen start={<BackButton onClick={onClose} />} end={<LanguageSwitcher />}>
      <article className={styles.page}>
        <h1 className={styles.title}>{t("howTo.title")}</h1>

        <Section id="goal" picture={<GoalPicture />}>
          <p>{t("howTo.goal.body")}</p>
        </Section>
        <Section id="push" picture={<PushPicture />}>
          <p>{t("howTo.push.body")}</p>
          <p>{t("howTo.push.more")}</p>
        </Section>
        <Section id="walk" picture={<WalkPicture />}>
          <p>{t("howTo.walk.body")}</p>
        </Section>
        <Section id="treasure" picture={<TreasurePicture />}>
          <p>{t("howTo.treasure.body")}</p>
        </Section>
        <Section id="home" picture={<HomePicture />}>
          <p>{t("howTo.home.body")}</p>
        </Section>
        <Section id="daily" picture={<IconCalendarStar className={styles.dailyIcon} size={56} stroke={1.5} aria-hidden="true" />}>
          <p>{t("howTo.daily.body")}</p>
          <p>{t("howTo.daily.more")}</p>
        </Section>
      </article>
    </Screen>
  );
}
