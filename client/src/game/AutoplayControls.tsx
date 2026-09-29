import { IconRobot } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./ShiftControls.module.css";

/** Hands the seat to the bot, from the game's top bar: always at hand, never competing with the turn's controls. */
export function AutoplayButton({ disabled, onClick }: { disabled: boolean; onClick(): void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="secondary"
      className={styles.icon}
      onClick={onClick}
      disabled={disabled}
      aria-label={t("autoplay.handOver")}
      title={t("autoplay.handOver")}
      data-autoplay-on=""
    >
      <IconRobot size={22} aria-hidden="true" />
    </Button>
  );
}

/** Under the board in place of the turn controls while the bot plays the viewer's seat: taking it back is the one action. */
export function AutoplayPanel({ pending, onTakeBack }: { pending: boolean; onTakeBack(): void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls} data-autoplay-panel="">
      <p className={styles.hint}>{t("autoplay.playing")}</p>
      <div className={styles.actions}>
        <Button onClick={onTakeBack} disabled={pending} aria-busy={pending || undefined}>
          {pending ? t("shift.waiting") : t("autoplay.takeBack")}
        </Button>
      </div>
    </div>
  );
}
