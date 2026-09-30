import { IconChevronLeft, IconChevronRight, IconFlipVertical, IconRotateClockwise2, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
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
  /** Corner mode with a piece: the shown spot of how many; "‹ n/m ›" replaces "Käännä" and "Peilaa". */
  spots?: { index: number; count: number };
  onStep?(delta: number): void;
  /** After "Vihje": which of the best moves is shown. */
  hint?: { index: number; count: number };
  /** Phone layout: the zoom toggle, and whether the zoom is on. */
  zoom?: { on: boolean; onToggle(): void };
}

/**
 * Under the board during play: the status line (what to do next, or why the piece does not fit
 * there), "Käännä", "Peilaa" (in corner mode "‹ n/m ›" instead), "Aseta", "Vihje", against bots on
 * the device "Peru", and on a phone the zoom toggle. Shown on every turn, disabled when it is not
 * the viewer's.
 */
export function PlaceControls(props: PlaceControlsProps) {
  const { enabled, pending, status, warning = false, chosen, ready, onTurn, onMirror, onPlace, onHint, onUndo, canUndo = false } = props;
  const { spots, onStep, hint, zoom } = props;
  const { t } = useTranslation();
  const canTransform = enabled && chosen && !pending;
  return (
    <div className={styles.controls}>
      <p className={warning ? `${styles.status} ${styles.warning}` : styles.status} role="status">
        {status}
      </p>
      <div className={styles.bar}>
        {spots ? (
          spots.count > 1 && (
            <span className={styles.stepper}>
              <Button variant="secondary" className={styles.icon} disabled={pending} onClick={() => onStep?.(-1)} aria-label={t("place.prevSpot")}>
                <IconChevronLeft size={20} aria-hidden="true" />
              </Button>
              <span className={styles.count} aria-live="polite">
                {t("place.spots", spots)}
              </span>
              <Button variant="secondary" className={styles.icon} disabled={pending} onClick={() => onStep?.(1)} aria-label={t("place.nextSpot")}>
                <IconChevronRight size={20} aria-hidden="true" />
              </Button>
            </span>
          )
        ) : (
          <>
            <Button variant="secondary" className={styles.withIcon} disabled={!canTransform} onClick={onTurn} title={t("place.turnTitle")}>
              <IconRotateClockwise2 size={20} aria-hidden="true" />
              {t("place.turn")}
            </Button>
            <Button variant="secondary" className={styles.withIcon} disabled={!canTransform} onClick={onMirror} title={t("place.mirrorTitle")}>
              <IconFlipVertical size={20} aria-hidden="true" />
              {t("place.mirror")}
            </Button>
          </>
        )}
        <Button className={styles.place} disabled={!enabled || !ready || pending} onClick={onPlace}>
          {t("place.place")}
        </Button>
        {onUndo && <UndoButton disabled={!canUndo || pending} onUndo={onUndo} />}
        <HintButton disabled={!enabled || pending} onHint={onHint} step={hint} />
        {zoom && (
          <Button
            variant="secondary"
            className={styles.icon}
            onClick={zoom.onToggle}
            aria-label={zoom.on ? t("board.zoomOut") : t("board.zoomIn")}
            title={zoom.on ? t("board.zoomOutTitle") : t("board.zoomInTitle")}
          >
            {zoom.on ? <IconZoomOut size={20} aria-hidden="true" /> : <IconZoomIn size={20} aria-hidden="true" />}
          </Button>
        )}
      </div>
    </div>
  );
}
