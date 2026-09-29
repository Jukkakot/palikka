// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { canVibrate, playSound, vibrate } from "./feedback.ts";
import { DEFAULT_SETTINGS, getSettings, loadSettings, reloadSettings, subscribeSettings, updateSettings } from "./settings.ts";
import { applyTheme } from "./theme.ts";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

afterEach(() => {
  localStorage.clear();
  reloadSettings();
  vi.unstubAllGlobals();
});

describe("settings › Settings on the device", () => {
  it("defaults without stored settings", () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ theme: "system", sounds: true, turnTitle: true, vibration: true });
  });

  it("Broken storage: garbage, wrong types and a throwing storage fall back to the defaults", () => {
    expect(loadSettings(memoryStorage({ "palikka.settings": "{not json" }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ "palikka.settings": "[]" }))).toEqual(DEFAULT_SETTINGS);
    const partly = loadSettings(memoryStorage({ "palikka.settings": JSON.stringify({ sounds: false, theme: "pink", vibration: "yes" }) }));
    expect(partly).toEqual({ ...DEFAULT_SETTINGS, sounds: false });
    const throwing = { getItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
  });

  it("Setting remembered: a change applies at once, notifies and survives a reload", () => {
    const listener = vi.fn();
    const stop = subscribeSettings(listener);
    updateSettings({ sounds: false, theme: "dark" });
    stop();
    expect(listener).toHaveBeenCalledOnce();
    expect(getSettings()).toMatchObject({ sounds: false, theme: "dark" });
    reloadSettings();
    expect(getSettings()).toMatchObject({ sounds: false, theme: "dark" });
  });
});

describe("settings › Theme setting", () => {
  it("Forced dark: light and dark set data-theme, system removes it", () => {
    const root = document.createElement("html");
    applyTheme("dark", root);
    expect(root.dataset.theme).toBe("dark");
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
    applyTheme("system", root);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});

describe("settings › Sounds and vibration", () => {
  it("sounds off, or no Web Audio, plays nothing", () => {
    updateSettings({ sounds: false });
    expect(playSound("turn")).toBe(false);
    updateSettings({ sounds: true });
    vi.stubGlobal("AudioContext", undefined);
    expect(playSound("turn")).toBe(false);
  });

  it("vibrates once when on and supported; not when off or unsupported", () => {
    expect(canVibrate()).toBe(false);
    expect(vibrate()).toBe(false);
    const pulse = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate: pulse });
    expect(vibrate()).toBe(true);
    expect(pulse).toHaveBeenCalledExactlyOnceWith(80);
    updateSettings({ vibration: false });
    expect(vibrate()).toBe(false);
    expect(pulse).toHaveBeenCalledOnce();
  });
});
