import { useTranslation } from "react-i18next";
import styles from "./Pawn.module.css";

const SHAPES: Record<number, string> = {
  1: "M50 32 A18 18 0 1 1 49.99 32 Z", // circle
  2: "M34 34 H66 V66 H34 Z", // square
  3: "M50 30 L69 66 H31 Z", // triangle
  4: "M50 29 L71 50 L50 71 L29 50 Z", // diamond
};

/** Where each seat stands when several pawns share a square: its own quadrant, so nobody jumps around. */
const CROWD_OFFSET: Record<number, readonly [number, number]> = { 1: [-21, -21], 2: [21, -21], 3: [21, 21], 4: [-21, 21] };
const CROWD_SCALE = 0.6;

export interface PawnProps {
  seat: number;
  /** The player's pawn 1–4 (colour + shape); the seat's own when missing. */
  look?: number;
  /** The player's nickname, for assistive technology. */
  name?: string;
  isMe?: boolean;
  connected?: boolean;
  /** Top-left of the square it stands on, in board units. */
  x?: number;
  y?: number;
  /** Duration of the move to (x, y); 0 = jump. */
  moveMs?: number;
  /** Shares its square with other pawns: drawn smaller in its seat's quadrant. */
  crowded?: boolean;
}

/** A player's pawn: its colour + shape (never colour alone); the viewer's own pawn gets a ring. The seat only picks the crowd quadrant. */
export function Pawn({ seat, look = seat, name = "", isMe = false, connected = true, x = 0, y = 0, moveMs = 0, crowded = false }: PawnProps) {
  const { t } = useTranslation();
  const label = t(isMe ? "board.pawnMe" : "board.pawn", { name });
  const [dx, dy] = CROWD_OFFSET[seat] ?? [0, 0];
  return (
    <g
      style={{ transform: `translate(${x}px, ${y}px)`, transition: moveMs ? `transform ${moveMs}ms linear` : "none" }}
      role="img"
      aria-label={label}
      data-seat={seat}
      data-look={look}
      data-me={isMe || undefined}
      data-crowded={crowded || undefined}
      className={connected ? undefined : styles.away}
    >
      <g transform={crowded ? `translate(${50 + dx} ${50 + dy}) scale(${CROWD_SCALE}) translate(-50 -50)` : undefined}>
        {isMe && <circle cx={50} cy={50} r={34} className={styles.ring} />}
        <path d={SHAPES[look]} className={styles.pawn} style={{ fill: `var(--seat-${look})` }} />
      </g>
    </g>
  );
}
