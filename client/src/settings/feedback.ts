import { getSettings } from "./settings.ts";

/** The generated sounds: a soft two-note chime for the turn. */
export type SoundName = "turn";

const NOTES: Record<SoundName, readonly number[]> = {
  turn: [587.33, 880], // D5 → A5
};
const NOTE_S = 0.12;
const GAIN = 0.08;

let context: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (context) return context;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return undefined;
  try {
    context = new Ctor();
  } catch {
    return undefined;
  }
  return context;
}

/** Plays a short sound when sounds are on; silent when off, unsupported or blocked by the browser. */
export function playSound(name: SoundName): boolean {
  if (!getSettings().sounds) return false;
  const ctx = audio();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime;
    NOTES[name].forEach((frequency, i) => {
      const at = start + i * NOTE_S;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(GAIN, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_S * 1.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + NOTE_S * 2);
    });
    return true;
  } catch {
    return false;
  }
}

/** Whether this device can vibrate at all (Android browsers; not iPhone or desktop). */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** One short pulse when vibration is on and supported. */
export function vibrate(): boolean {
  if (!getSettings().vibration || !canVibrate()) return false;
  try {
    return navigator.vibrate(80);
  } catch {
    return false;
  }
}
