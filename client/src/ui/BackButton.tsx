import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button.tsx";
import styles from "./BackButton.module.css";

/** "Takaisin" at the start of a sub-screen's top bar (settings, rules). */
export function BackButton({ onClick }: { onClick(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.back} onClick={onClick}>
      <IconArrowLeft size={20} aria-hidden="true" />
      {t("settings.back")}
    </Button>
  );
}
