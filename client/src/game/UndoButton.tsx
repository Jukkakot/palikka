import { IconArrowBackUp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

/** "Peru siirto" (games against bots on the device): takes back the last move. An icon button; disabled with nothing to undo. */
export function UndoButton({ disabled, onUndo }: { disabled: boolean; onUndo(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.icon} onClick={onUndo} disabled={disabled} aria-label={t("undo.label")} title={t("undo.label")}>
      <IconArrowBackUp size={22} aria-hidden="true" />
    </Button>
  );
}
