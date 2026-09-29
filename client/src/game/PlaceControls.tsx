import { useTranslation } from "react-i18next";
import styles from "./Controls.module.css";
import { HintButton } from "./HintButton.tsx";
import { UndoButton } from "./UndoButton.tsx";

export interface PlaceControlsProps {
  /** The viewer's own turn. */
  enabled: boolean;
  pending: boolean;
  onHint(): void;
  /** Daily puzzle only: takes back the last placement. */
  onUndo?(): void;
  canUndo?: boolean;
}

/**
 * Under the board during play: what to do (tap an empty cell), "Vihje", and in the daily puzzle
 * "Peru". Shown on every turn, disabled when it is not the viewer's.
 */
export function PlaceControls({ enabled, pending, onHint, onUndo, canUndo = false }: PlaceControlsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <p className={styles.lead}>{enabled ? t("place.hint") : t("place.wait")}</p>
        {onUndo && <UndoButton disabled={!canUndo || pending} onUndo={onUndo} />}
        <HintButton disabled={!enabled || pending} onHint={onHint} />
      </div>
    </div>
  );
}
