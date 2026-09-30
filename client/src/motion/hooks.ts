import { useEffect, useState } from "react";
import { emptiedSince, filledSince } from "./boardDiff.ts";

/**
 * Small motion hooks, generic (no game names), candidates for the shared template. They keep what
 * they compare in state and update it during render, so a transition is seen on the very render
 * that brings it and stays until the next change (an unrelated re-render does not cut an animation).
 */

/** Whether the device asks for reduced motion (false where it cannot be asked). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The value before the last change of `value` (`same` decides what counts as a change); undefined
 * until it first changes. Stable across re-renders that do not change it.
 */
export function usePrevious<T>(value: T, same: (a: T, b: T) => boolean = Object.is): T | undefined {
  const [pair, setPair] = useState<{ current: T; previous?: T }>({ current: value });
  if (!same(pair.current, value)) {
    setPair({ current: value, previous: pair.current });
    return pair.current;
  }
  return pair.previous;
}

/**
 * The squares the latest board update filled: a update with new squares replaces them, one that only
 * empties squares clears them, an unchanged board keeps them. The first board, and any change of
 * `resetKey` (another game), has none.
 */
export function useLastMove(board: readonly number[], resetKey: unknown): ReadonlySet<number> | undefined {
  const [seen, setSeen] = useState<{ board: readonly number[]; resetKey: unknown; mark?: ReadonlySet<number> }>({ board, resetKey });
  if (seen.board === board && Object.is(seen.resetKey, resetKey)) return seen.mark;
  let mark = seen.mark;
  if (!Object.is(seen.resetKey, resetKey)) mark = undefined;
  else {
    const filled = filledSince(seen.board, board);
    if (filled.size > 0) mark = filled;
    else if (emptiedSince(seen.board, board)) mark = undefined;
  }
  setSeen({ board, resetKey, mark });
  return mark;
}

/**
 * True once `done` has been seen going from false to true (a game ending, a puzzle solved while
 * watched); false when it was already true on the first render (a reload, a late spectator).
 */
export function useEnded(done: boolean): boolean {
  const [sawOpen, setSawOpen] = useState(!done);
  if (!done && !sawOpen) setSawOpen(true);
  return done && sawOpen;
}

/**
 * A short flash each time `key` changes (not on the first render): a running number (1, 2, …) for
 * `ms`, then undefined. The number's parity lets a class alternate between two identical keyframes,
 * so a quick repeat restarts the animation.
 */
export function useBlip(key: unknown, ms: number): number | undefined {
  const [blip, setBlip] = useState<{ key: unknown; count: number; on: boolean }>({ key, count: 0, on: false });
  let current = blip;
  if (!Object.is(blip.key, key)) {
    current = { key, count: blip.count + 1, on: true };
    setBlip(current);
  }
  useEffect(() => {
    if (!current.on) return;
    const timer = setTimeout(() => setBlip((b) => (b.count === current.count ? { ...b, on: false } : b)), ms);
    return () => clearTimeout(timer);
  }, [current.on, current.count, ms]);
  return current.on ? current.count : undefined;
}

const easeOut =(t: number) => 1 - (1 - t) ** 3;

/**
 * A number counting from `from` up to `target` in `ms` (ease-out), while `run`; the target at once
 * when not running or when the device asks for reduced motion.
 */
export function useCountUp(target: number, run: boolean, ms = 900, from = 0): number {
  const animate = run && !prefersReducedMotion() && target !== from && typeof requestAnimationFrame === "function";
  const [value, setValue] = useState(animate ? from : target);
  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / ms, 1);
      setValue(Math.round(from + (target - from) * easeOut(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, from, ms]);
  return animate ? value : target;
}
