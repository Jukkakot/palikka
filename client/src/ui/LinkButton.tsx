import type { ButtonHTMLAttributes } from "react";
import styles from "./LinkButton.module.css";

/** A quiet text link that acts inside the app (no navigation), with a full-size tap area. */
export function LinkButton({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={[styles.link, className].filter(Boolean).join(" ")} {...rest} />;
}
