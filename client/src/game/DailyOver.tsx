import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

export interface DailyOverProps {
  onHome(): void;
  /** "Uudelleen": the same puzzle from the start. */
  onRetry(): void;
}

/** Under the board once the daily puzzle is solved: back to the start, or try again (the main action). */
export function DailyOver({ onHome, onRetry }: DailyOverProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onHome}>
          {t("result.home")}
        </Button>
        <Button onClick={onRetry}>{t("daily.retry")}</Button>
      </div>
    </div>
  );
}
