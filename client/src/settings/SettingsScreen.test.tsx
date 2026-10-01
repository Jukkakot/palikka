// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { clientVersion } from "@game-kit/client";
import { getSettings, reloadSettings } from "./settings.ts";
import { SettingsScreen } from "./SettingsScreen.tsx";

afterEach(() => {
  localStorage.clear();
  reloadSettings();
});

describe("settings › settings screen", () => {
  it("toggles and the theme apply at once and are remembered; vibration is disabled where unsupported; Takaisin closes", () => {
    const onClose = vi.fn();
    render(<SettingsScreen onClose={onClose} />);

    const sounds = screen.getByRole("switch", { name: /^Äänet/ });
    expect((sounds as HTMLInputElement).checked).toBe(true);
    fireEvent.click(sounds);
    expect(getSettings().sounds).toBe(false);
    expect(JSON.parse(localStorage.getItem("palikka.settings")!)).toMatchObject({ sounds: false });

    fireEvent.click(screen.getByRole("button", { name: "Tumma" }));
    expect(getSettings().theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Tumma" }).getAttribute("aria-pressed")).toBe("true");

    const vibration = screen.getByRole("switch", { name: /^Värinä/ }) as HTMLInputElement;
    expect(vibration.disabled).toBe(true);
    expect(screen.getByText("Tämä laite ei tue värinää.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("how-to-play › Rules screen reachable before and during a game", () => {
  it("During a game: the settings open the rules, Takaisin returns to the settings", () => {
    const onClose = vi.fn();
    render(<SettingsScreen onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Näin pelaat" }));
    expect(screen.getByRole("heading", { level: 1, name: "Näin pelaat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(screen.getByRole("heading", { level: 1, name: "Asetukset" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("settings › Game details for a bug report", () => {
  const copyDetails = /^Kopioi pelin tiedot/;
  const tapCopy = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copyDetails }));
    });
  };

  it("Copy during a game: copies id, local date and time and version, then confirms", async () => {
    const copy = vi.fn(async (_text: string) => {});
    render(<SettingsScreen onClose={vi.fn()} roomId="brave-otters-sing" copy={copy} />);
    await tapCopy();
    // The time separator depends on ICU; the version comes from the build.
    const line = copy.mock.calls[0]![0];
    expect(line).toMatch(/^Peli brave-otters-sing · \d{1,2}\.\d{1,2}\.\d{4} \d{2}[.:]\d{2} · v \S+$/);
    expect(line.endsWith("v " + clientVersion())).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Kopioitu");
  });

  it("Game on the device: the line carries the full local id", async () => {
    const copy = vi.fn(async (_text: string) => {});
    render(<SettingsScreen onClose={vi.fn()} roomId="local-mujxitgji577" copy={copy} />);
    await tapCopy();
    expect(copy.mock.calls[0]![0]).toMatch(/^Peli local-mujxitgji577 · /);
  });

  it("From the start screen: date, time and version only", async () => {
    const copy = vi.fn(async (_text: string) => {});
    render(<SettingsScreen onClose={vi.fn()} copy={copy} />);
    await tapCopy();
    expect(copy.mock.calls[0]![0]).toMatch(/^\d{1,2}\.\d{1,2}\.\d{4} \d{2}[.:]\d{2} · v \S+$/);
  });

  it("Copying not possible: the line is shown selectable", async () => {
    const copy = vi.fn(async () => Promise.reject(new Error("denied")));
    render(<SettingsScreen onClose={vi.fn()} roomId="brave-otters-sing" copy={copy} />);
    await tapCopy();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toContain("brave-otters-sing");
    expect(input.readOnly).toBe(true);
  });
});
