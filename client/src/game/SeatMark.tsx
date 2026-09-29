import styles from "./SeatMark.module.css";

/** A seat's colour as a small flat square (the theme's piece cell); the viewer's own has a ring. */
export function SeatMark({ seat, isMe = false, size = 20 }: { seat: number; isMe?: boolean; size?: number }) {
  return (
    <span
      className={isMe ? `${styles.mark} ${styles.me}` : styles.mark}
      style={{ width: size, height: size, background: `var(--seat-${seat})` }}
      data-seat={seat}
      aria-hidden="true"
    />
  );
}
