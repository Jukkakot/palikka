import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

/** The app's only button style: primary for the one main action on a screen, secondary for the rest. */
export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}
