import { IconDoorExit } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

/** The leave action in the game's top bar: visible but secondary, an icon with its name for assistive technology. */
export function LeaveButton({ onClick }: { onClick(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.icon} onClick={onClick} aria-label={t("leave.button")} title={t("leave.button")}>
      <IconDoorExit size={22} aria-hidden="true" />
    </Button>
  );
}

/**
 * Under the board in place of the turn controls: confirm leaving a running game. Same pattern and
 * slot as the kick confirmation, so the question sits where the thumb already is.
 */
export function LeaveConfirm({ onLeave, onCancel }: { onLeave(): void; onCancel(): void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls} data-leave-confirm="">
      <p className={styles.hint}>{t("leave.confirm")}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {t("leave.cancel")}
        </Button>
        <Button onClick={onLeave}>{t("leave.yes")}</Button>
      </div>
    </div>
  );
}
