import { IconArrowBackUp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./ShiftControls.module.css";

/** "Peru siirto" (daily puzzle): takes back the last shift. An icon button like rotate; disabled with nothing to undo. */
export function UndoButton({ disabled, onUndo }: { disabled: boolean; onUndo(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.icon} onClick={onUndo} disabled={disabled} aria-label={t("daily.undo")} title={t("daily.undo")}>
      <IconArrowBackUp size={22} aria-hidden="true" />
    </Button>
  );
}
