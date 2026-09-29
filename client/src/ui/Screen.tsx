import type { ReactNode } from "react";
import styles from "./Screen.module.css";

export interface ScreenProps {
  /** Left side of the top bar (e.g. the game id). */
  start?: ReactNode;
  /** Right side of the top bar (e.g. the language switcher). */
  end?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Centre the content vertically (start and message screens). */
  centered?: boolean;
}

/** Page frame shared by every screen: top bar, content, optional footer; safe-area aware. */
export function Screen({ start, end, children, footer, centered = false }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.bar}>
        <div className={styles.side}>{start}</div>
        <div className={styles.side}>{end}</div>
      </header>
      <main className={[styles.content, centered && styles.centered].filter(Boolean).join(" ")}>{children}</main>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}
