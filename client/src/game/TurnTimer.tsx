import { IconAlarm, IconClock } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./TurnLine.module.css";
import { formatSeconds, secondsLeft, URGENT_SECONDS } from "./turnClock.ts";

const TICK_MS = 250;

/**
 * The current turn's time left as m:ss; emphasised with a different icon in the last 10 s, "Aika loppui" once the
 * server says the time is up. Nothing while no clock runs. Only this component re-renders every tick.
 */
export function TurnTimer({ deadline, expired }: { deadline: number; expired: boolean }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const ticking = deadline > 0 && !expired;
  useEffect(() => {
    if (!ticking) return;
    // A stale `now` right after a new deadline is harmless: secondsLeft() clamps to the limit.
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [ticking, deadline]);

  if (expired) {
    return (
      <span className={`${styles.timer} ${styles.urgent}`} role="timer" data-expired="">
        <IconAlarm size={20} stroke={2} aria-hidden="true" />
        {t("turn.timeUp")}
      </span>
    );
  }
  if (!ticking) return null;
  const left = secondsLeft(deadline, now);
  const urgent = left <= URGENT_SECONDS;
  const Icon = urgent ? IconAlarm : IconClock;
  return (
    <span
      className={urgent ? `${styles.timer} ${styles.urgent}` : styles.timer}
      role="timer"
      aria-label={t("turn.timeLeft", { time: formatSeconds(left) })}
      data-urgent={urgent || undefined}
    >
      <Icon size={20} stroke={2} aria-hidden="true" />
      {formatSeconds(left)}
    </span>
  );
}
