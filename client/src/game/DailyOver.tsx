import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./ShiftControls.module.css";

export interface DailyOverProps {
  onHome(): void;
  /** "Uudelleen": the same puzzle from the start. */
  onRetry(): void;
  /** "Näytä paras reitti": replays a best solution on the board. */
  onReplay(): void;
}

/** Under the board once the daily puzzle is solved: back to the start, try again (the main action), and the best route. */
export function DailyOver({ onHome, onRetry, onReplay }: DailyOverProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onHome}>
          {t("result.home")}
        </Button>
        <Button onClick={onRetry}>{t("daily.retry")}</Button>
      </div>
      <Button variant="secondary" onClick={onReplay}>
        {t("daily.replay")}
      </Button>
    </div>
  );
}
