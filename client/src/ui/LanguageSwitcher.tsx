import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import styles from "./LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.switcher} role="group" aria-label={t("language.label")}>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          className={styles.option}
          aria-pressed={i18n.resolvedLanguage === lng}
          onClick={() => void i18n.changeLanguage(lng)}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  );
}
