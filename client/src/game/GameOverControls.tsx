import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import styles from "./Controls.module.css";

export interface GameOverControlsProps {
  /** "Pelaa uudelleen"; omitted for a spectator. */
  onRematch?(): void;
  /** True while the rematch is being set up. */
  rematching?: boolean;
  /** "Uusi bottipeli" for a spectator of a bot-only game. */
  onNewBotGame?(): void;
  /** "Alkuun": back to the start screen. */
  onHome(): void;
}

/**
 * Under the board once the game has finished: the next game (a rematch, or another bot game to
 * watch) as the primary action, and the way back to the start screen. Same slot and width as the
 * turn controls.
 */
export function GameOverControls({ onRematch, rematching = false, onNewBotGame, onHome }: GameOverControlsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onHome}>
          {t("result.home")}
        </Button>
        {onRematch && (
          <Button onClick={onRematch} disabled={rematching} aria-busy={rematching || undefined}>
            {t("result.rematch")}
          </Button>
        )}
        {onNewBotGame && <Button onClick={onNewBotGame}>{t("spectate.newBotGame")}</Button>}
      </div>
    </div>
  );
}
