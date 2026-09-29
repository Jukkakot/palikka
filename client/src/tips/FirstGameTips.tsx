import { IconBulb, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./FirstGameTips.module.css";
import { isRelevant, loadSeenTips, pickTip, saveSeenTips, type TipId, type TipSituation } from "./tips.ts";

/**
 * The first game's one-time tips (the goal, how to place): one small card at the top of the
 * screen, clear of the board and the controls. A tip counts as seen once shown; it goes away
 * when closed or when its moment passes, and the next relevant unseen tip follows.
 */
export function FirstGameTips(situation: TipSituation) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState(() => loadSeenTips());
  const [current, setCurrent] = useState<TipId>();

  if (current && !isRelevant(current, situation)) {
    setCurrent(undefined);
  } else if (!current) {
    const next = pickTip(situation, seen);
    if (next) {
      setCurrent(next);
      setSeen(new Set(seen).add(next));
    }
  }

  useEffect(() => {
    if (seen.size > 0) saveSeenTips(seen);
  }, [seen]);

  return (
    <div className={styles.region} role="status">
      {current && (
        <div key={current} className={styles.card} data-tip={current}>
          <IconBulb size={20} aria-hidden="true" className={styles.icon} />
          <p className={styles.text}>{t(`tips.${current}`)}</p>
          <button type="button" className={styles.close} aria-label={t("tips.close")} title={t("tips.close")} onClick={() => setCurrent(undefined)}>
            <IconX size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
