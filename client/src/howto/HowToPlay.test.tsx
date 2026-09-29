// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { HowToPlay } from "./HowToPlay.tsx";

afterEach(async () => {
  await i18n.changeLanguage("fi");
});

describe("how-to-play › What the rules screen explains", () => {
  it("sections in order, the daily puzzle spelled out", async () => {
    await i18n.changeLanguage("fi");
    render(<HowToPlay onClose={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Tavoite", "Vuoro", "Päivän pulma"]);
    const daily = screen.getByRole("region", { name: "Päivän pulma" }).textContent!;
    expect(daily).toMatch(/sama kaikille/);
    expect(daily).toMatch(/perua/);
  });

  it("English: title and sections follow the language at once", async () => {
    render(<HowToPlay onClose={vi.fn()} />);
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("heading", { level: 1, name: "How to play" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "A turn" })).toBeTruthy();
  });
});
