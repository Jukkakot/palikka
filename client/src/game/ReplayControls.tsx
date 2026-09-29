import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./ShiftControls.module.css";
import type { ReplayFrame } from "./solutionReplay.ts";

export interface ReplayControlsProps {
  index: number;
  count: number;
  frame: ReplayFrame;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
}

/** Under the board while the best route is replayed: which step, what it does, back, forward and close. */
export function ReplayControls({ index, count, frame, onPrev, onNext, onClose }: ReplayControlsProps) {
  const { t } = useTranslation();
  const what =
    frame.step === "start"
      ? t("daily.replayStart")
      : t(frame.step === "shift" ? "daily.replayShift" : "daily.replayMove", { turn: frame.turn });
  return (
    <div className={styles.controls}>
      <p className={styles.hint} role="status">
        {t("daily.replayTitle", { n: index + 1, count })} · {what}
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" className={styles.lead} onClick={onClose}>
          {t("daily.replayClose")}
        </Button>
        <Button variant="secondary" className={styles.icon} onClick={onPrev} disabled={index === 0} aria-label={t("daily.replayPrev")} title={t("daily.replayPrev")}>
          <IconChevronLeft size={22} aria-hidden="true" />
        </Button>
        <Button className={styles.icon} onClick={onNext} disabled={index >= count - 1} aria-label={t("daily.replayNext")} title={t("daily.replayNext")}>
          <IconChevronRight size={22} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
