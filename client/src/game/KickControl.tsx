import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

export interface KickControlProps {
  /** Seat of the slow current player. */
  seat: number;
  /** Their nickname. */
  name: string;
  /** A command waits for the server. */
  pending: boolean;
  onKick(): void;
}

/**
 * Under the board for the other players once the current player's time is up: remove them, after a confirmation.
 * Same slot and width as the turn controls; remount it (key) when the turn changes to drop a pending confirmation.
 */
export function KickControl({ seat, name, pending, onKick }: KickControlProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  return (
    <div className={styles.controls} data-kick-seat={seat}>
      <p className={styles.hint}>{asking ? t("kick.confirm", { name }) : t("kick.timeUp", { name })}</p>
      <div className={styles.actions}>
        {asking ? (
          <>
            <Button variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
              {t("kick.cancel")}
            </Button>
            <Button onClick={onKick} disabled={pending} aria-busy={pending || undefined}>
              {pending ? t("common.waiting") : t("kick.yes")}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setAsking(true)}>
            {t("kick.button", { name })}
          </Button>
        )}
      </div>
    </div>
  );
}
