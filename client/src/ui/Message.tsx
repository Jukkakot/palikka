import type { ReactNode } from "react";
import styles from "./Message.module.css";

export interface MessageProps {
  title: string;
  children?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  /** `alert` for errors, `status` for progress that assistive tech should announce. */
  role?: "alert" | "status";
}

/** Centred title + short text + optional action: used by start, connecting, error and crash screens. */
export function Message({ title, children, action, role }: MessageProps) {
  return (
    <section className={styles.message} role={role}>
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.body}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
