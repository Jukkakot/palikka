import { TURN_TIME_LIMIT_SECONDS } from "@palikka/rules";

/** Seconds left from which the countdown is emphasised. */
export const URGENT_SECONDS = 10;

/** Whole seconds left until `deadline` (server epoch ms), clamped to the turn limit so clock skew cannot show more. */
export function secondsLeft(deadline: number, now: number): number {
  const ms = Math.min(Math.max(deadline - now, 0), TURN_TIME_LIMIT_SECONDS * 1000);
  return Math.ceil(ms / 1000);
}

/** 42 → "0:42". */
export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
