import { IconBulb } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

/**
 * "Vihje": shows the bots' choice for the viewer's turn; pressed again, the next of the best few
 * ("Vihje 2/3"). Shown in both steps, disabled when it cannot be used.
 */
export function HintButton({ disabled, onHint, step }: { disabled: boolean; onHint(): void; step?: { index: number; count: number } }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.withIcon} onClick={onHint} disabled={disabled} title={t("hint.title")}>
      <IconBulb size={20} aria-hidden="true" />
      {step ? t("hint.step", step) : t("hint.button")}
    </Button>
  );
}
