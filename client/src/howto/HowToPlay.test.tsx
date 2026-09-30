// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { HowToPlay } from "./HowToPlay.tsx";

afterEach(async () => {
  await i18n.changeLanguage("fi");
});

describe("how-to-play › What the rules screen explains", () => {
  it("sections in order, the corner rule spelled out", async () => {
    await i18n.changeLanguage("fi");
    render(<HowToPlay onClose={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Tavoite", "Vuoro", "Palikan asettaminen", "Pisteet", "Pelimuodot"]);
    const place = screen.getByRole("region", { name: "Palikan asettaminen" }).textContent!;
    expect(place).toMatch(/kulmasta, mutta ei koskaan sivusta/);
  });

  it("Variants section: the four variants, one or two lines each", () => {
    render(<HowToPlay onClose={vi.fn()} />);
    const section = screen.getByRole("region", { name: "Pelimuodot" });
    const lines = [...section.querySelectorAll("p")].map((p) => p.textContent);
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l!.split(":")[0])).toEqual(["Perus", "Duo", "Tuplaväri", "Kolmikko"]);
    expect(section.textContent).toMatch(/14×14/);
    expect(section.textContent).toMatch(/lasketaan yhteen/);
    expect(section.textContent).toMatch(/vuorotellen/);
  });

  it("Pictures: the start corner, corner contact and edge contact with their captions", () => {
    render(<HowToPlay onClose={vi.fn()} />);
    expect(screen.getByText("Ensimmäinen palikka aloituskulmaan")).toBeTruthy();
    expect(screen.getByText("Kulmakosketus omaan väriin: sallittu")).toBeTruthy();
    expect(screen.getByText("Sivukosketus omaan väriin: ei sallittu")).toBeTruthy();
    expect(document.querySelectorAll("figure[data-picture]")).toHaveLength(3);
  });

  it("English: title and sections follow the language at once", async () => {
    render(<HowToPlay onClose={vi.fn()} />);
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("heading", { level: 1, name: "How to play" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "A turn" })).toBeTruthy();
  });
});
