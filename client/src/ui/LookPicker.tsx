import { LOOKS, type Look } from "@labyrinth/protocol";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Pawn } from "../game/Pawn.tsx";
import styles from "./LookPicker.module.css";

export interface LookPickerProps {
  /** The pawn shown as chosen. */
  value: number;
  /** Pawns other players hold: shown, but disabled. */
  taken?: ReadonlySet<number>;
  disabled?: boolean;
  onPick(look: Look): void;
}

/** "Nappulasi": the four pawns (colour + shape) as a row of toggle buttons; the chosen one is ringed. */
export function LookPicker({ value, taken, disabled = false, onPick }: LookPickerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <div className={styles.picker} role="group" aria-labelledby={titleId}>
      <span id={titleId} className={styles.title}>
        {t("look.title")}
      </span>
      <div className={styles.row}>
        {LOOKS.map((look) => {
          const held = taken?.has(look) ?? false;
          const name = t(`look.names.${look}`);
          return (
            <button
              key={look}
              type="button"
              className={styles.option}
              aria-pressed={look === value}
              aria-label={held ? t("look.taken", { name }) : name}
              title={held ? t("look.taken", { name }) : name}
              disabled={disabled || held}
              data-look={look}
              onClick={() => look !== value && onPick(look)}
            >
              <svg viewBox="26 26 48 48" aria-hidden="true" focusable="false">
                <Pawn seat={look} look={look} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
