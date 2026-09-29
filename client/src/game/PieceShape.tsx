import { ORIENTATIONS } from "@palikka/rules";
import styles from "./PieceShape.module.css";

/**
 * One orientation of a piece as flat squares in a seat's colour (the board's look, small). `cell` is
 * the square size in px; the shape keeps its own width and height.
 */
export function PieceShape({ piece, orientation = 0, seat, cell = 8 }: { piece: number; orientation?: number; seat: number; cell?: number }) {
  const { cells, height, width } = ORIENTATIONS[piece]![orientation]!;
  return (
    <span
      className={styles.shape}
      style={{ gridTemplateColumns: `repeat(${width}, ${cell}px)`, gridTemplateRows: `repeat(${height}, ${cell}px)` }}
      aria-hidden="true"
    >
      {cells.map(([r, c]) => (
        <span key={`${r},${c}`} className={styles.square} style={{ gridRow: r + 1, gridColumn: c + 1, background: `var(--seat-${seat})` }} />
      ))}
    </span>
  );
}
