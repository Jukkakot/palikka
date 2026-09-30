import { VARIANT_IDS, type VariantId } from "@palikka/rules";
import { useTranslation } from "react-i18next";
import styles from "./VariantPicker.module.css";

/**
 * The four variants as chips in one row (one chosen), with a line about the chosen one under them.
 * The start screen's bot way and the host's waiting room use it.
 */
export function VariantPicker({ value, onChange, disabled = false }: { value: VariantId; onChange(variant: VariantId): void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.picker}>
      <div className={styles.chips} role="radiogroup" aria-label={t("variant.label")}>
        {VARIANT_IDS.map((variant) => (
          <button
            key={variant}
            type="button"
            role="radio"
            aria-checked={variant === value}
            className={styles.chip}
            disabled={disabled}
            onClick={() => variant !== value && onChange(variant)}
            data-variant={variant}
          >
            {t(`variant.${variant}`)}
          </button>
        ))}
      </div>
      <p className={styles.about}>{t(`variant.about.${value}`)}</p>
    </div>
  );
}
