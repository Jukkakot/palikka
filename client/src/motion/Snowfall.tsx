import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "./hooks.ts";
import styles from "./Snowfall.module.css";

/** A small seeded generator (mulberry32), so the flakes fall the same way every time. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SnowfallProps {
  /** How many flakes. */
  count?: number;
  /** How long until it is gone, in ms. */
  ms?: number;
  seed?: number;
}

/**
 * A one-off snowfall of square flakes over the whole screen (colour `--snow`): fixed, never takes the
 * pointer, gone after `ms`. Not mounted at all when the device asks for reduced motion. Generic, a
 * candidate for the shared template.
 */
export function Snowfall({ count = 24, ms = 2500, seed = 7 }: SnowfallProps) {
  const [on, setOn] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  const flakes = useMemo(() => {
    const random = seeded(seed);
    return Array.from({ length: count }, () => {
      const fall = 0.55 + random() * 0.35;
      return {
        left: `${random() * 100}%`,
        size: `${4 + Math.round(random() * 6)}px`,
        delay: `${Math.round(random() * (1 - fall) * ms)}ms`,
        duration: `${Math.round(fall * ms)}ms`,
        drift: `${Math.round((random() - 0.5) * 60)}px`,
        spin: `${Math.round((random() - 0.5) * 360)}deg`,
      };
    });
  }, [count, ms, seed]);
  if (!on) return null;
  return (
    <div className={styles.snow} aria-hidden="true" data-snowfall="">
      {flakes.map((f, i) => (
        <span
          key={i}
          className={styles.flake}
          style={
            {
              left: f.left,
              width: f.size,
              height: f.size,
              animationDelay: f.delay,
              animationDuration: f.duration,
              "--drift": f.drift,
              "--spin": f.spin,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
