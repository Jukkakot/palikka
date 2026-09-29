import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Badge.module.css";

export interface BadgeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

/** Small pill for secondary information that can be tapped (e.g. the game id). Tap area ≥ 44 px. */
export function Badge({ className, type = "button", ...rest }: BadgeProps) {
  return <button type={type} className={[styles.badge, className].filter(Boolean).join(" ")} {...rest} />;
}
