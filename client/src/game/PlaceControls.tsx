import { IconFlipVertical, IconRotateClockwise2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";
import { HintButton } from "./HintButton.tsx";
import { UndoButton } from "./UndoButton.tsx";

export interface PlaceControlsProps {
  /** The viewer's own turn. */
  enabled: boolean;
  pending: boolean;
  /** What the status line says: the next step, or why the preview does not fit. */
  status: string;
  /** The status is a refusal reason (shown in the warning colour). */
  warning?: boolean;
  /** A piece is chosen: "Käännä" and "Peilaa" work. */
  chosen: boolean;
  /** The preview is legal: "Aseta" works. */
  ready: boolean;
  onTurn(): void;
  onMirror(): void;
  onPlace(): void;
  onHint(): void;
  /** Games against bots on the device only: takes back the last move. */
  onUndo?(): void;
  canUndo?: boolean;
}

/**
 * Under the board during play: the status line (what to do next, or why the piece does not fit
 * there), "Käännä", "Peilaa", "Aseta", "Vihje", and against bots on the device "Peru". Shown on every
 * turn, disabled when it is not the viewer's.
 */
export function PlaceControls(props: PlaceControlsProps) {
  const { enabled, pending, status, warning = false, chosen, ready, onTurn, onMirror, onPlace, onHint, onUndo, canUndo = false } = props;
  const { t } = useTranslation();
  const canTransform = enabled && chosen && !pending;
  return (
    <div className={styles.controls}>
      <p className={warning ? `${styles.status} ${styles.warning}` : styles.status} role="status">
        {status}
      </p>
      <div className={styles.bar}>
        <Button variant="secondary" className={styles.withIcon} disabled={!canTransform} onClick={onTurn} title={t("place.turnTitle")}>
          <IconRotateClockwise2 size={20} aria-hidden="true" />
          {t("place.turn")}
        </Button>
        <Button variant="secondary" className={styles.withIcon} disabled={!canTransform} onClick={onMirror} title={t("place.mirrorTitle")}>
          <IconFlipVertical size={20} aria-hidden="true" />
          {t("place.mirror")}
        </Button>
        <Button className={styles.place} disabled={!enabled || !ready || pending} onClick={onPlace}>
          {t("place.place")}
        </Button>
        {onUndo && <UndoButton disabled={!canUndo || pending} onUndo={onUndo} />}
        <HintButton disabled={!enabled || pending} onHint={onHint} />
      </div>
    </div>
  );
}
