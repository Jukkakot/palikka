// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { reloadSettings, updateSettings } from "./settings.ts";
import { isAlertTurn, useTurnAlert } from "./turnAlert.ts";

type View = Parameters<typeof isAlertTurn>[0];
const base = { isMyTurn: true, spectating: false, myAutoplay: false, finished: false, phase: "playing", seats: [{}, {}] } as unknown as View;
const view = (patch: Partial<View> = {}): View => ({ ...base, ...patch });

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  setHidden(false);
  localStorage.clear();
  reloadSettings();
  document.title = "Palikka";
});

describe("settings › Turn notification", () => {
  it("fires only for the viewer's own, self-played turn in a running game with others", () => {
    expect(isAlertTurn(view())).toBe(true);
    expect(isAlertTurn(view({ isMyTurn: false }))).toBe(false);
    expect(isAlertTurn(view({ spectating: true }))).toBe(false);
    expect(isAlertTurn(view({ myAutoplay: true }))).toBe(false);
    expect(isAlertTurn(view({ finished: true }))).toBe(false);
    expect(isAlertTurn(view({ phase: "waiting" }))).toBe(false);
    expect(isAlertTurn(view({ seats: [{}] as View["seats"] }))).toBe(false);
  });

  it("Backgrounded tab: the title announces the turn while hidden and returns when visible or the turn ends", () => {
    document.title = "Palikka";
    setHidden(true);
    const { rerender } = renderHook((v: View) => useTurnAlert(v), { initialProps: view({ isMyTurn: false }) });
    expect(document.title).toBe("Palikka");
    rerender(view());
    expect(document.title).toBe("● Sinun vuorosi – Palikka");
    setHidden(false);
    expect(document.title).toBe("Palikka");
    setHidden(true);
    expect(document.title).toBe("● Sinun vuorosi – Palikka");
    rerender(view({ isMyTurn: false }));
    expect(document.title).toBe("Palikka");
  });

  it("Visible page: the title does not change; the tab title setting off keeps it too", () => {
    const visible = renderHook(() => useTurnAlert(view()));
    expect(document.title).toBe("Palikka");
    visible.unmount();
    updateSettings({ turnTitle: false });
    setHidden(true);
    renderHook(() => useTurnAlert(view()));
    expect(document.title).toBe("Palikka");
  });

  it("vibrates once when the turn begins", () => {
    const pulse = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate: pulse });
    const { rerender } = renderHook((v: View) => useTurnAlert(v), { initialProps: view({ isMyTurn: false }) });
    rerender(view());
    rerender(view());
    expect(pulse).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
