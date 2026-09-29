import type { InputHTMLAttributes } from "react";
import styles from "./Switch.module.css";

/** An on/off switch: a checkbox with the switch role, drawn as a track and knob. Put it in a label. */
export function Switch({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">) {
  return <input type="checkbox" role="switch" className={[styles.switch, className].filter(Boolean).join(" ")} {...rest} />;
}
