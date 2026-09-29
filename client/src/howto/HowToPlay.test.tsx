// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { HowToPlay } from "./HowToPlay.tsx";

afterEach(async () => {
  await i18n.changeLanguage("fi");
});

describe("how-to-play › What the rules screen explains", () => {
  it("sections in order, push and daily rules spelled out, pictures hidden from assistive technology", async () => {
    await i18n.changeLanguage("fi");
    const { container } = render(<HowToPlay onClose={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Tavoite", "Työnnä laatta", "Kävele", "Aarteet", "Paluu kotiin", "Päivän pulma"]);

    const push = screen.getByRole("region", { name: "Työnnä laatta" }).textContent!;
    expect(push).toMatch(/kääntää/);
    expect(push).toMatch(/seuraava vapaa laatta/);
    expect(push).toMatch(/palaa rivin toiseen päähän/);
    expect(push).toMatch(/ei saa kumota/);

    const daily = screen.getByRole("region", { name: "Päivän pulma" }).textContent!;
    expect(daily).toMatch(/sama kaikille/);
    expect(daily).toMatch(/parhaan mahdollisen/);
    expect(daily).toMatch(/perua/);
    expect(daily).toMatch(/paras yrityksesi/);

    const pictures = [...container.querySelectorAll("section > svg")];
    expect(pictures).toHaveLength(6);
    expect(pictures.every((svg) => svg.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("how-to-play › Language and layout of the rules screen", () => {
  it("English: title and sections follow the language at once", async () => {
    await i18n.changeLanguage("fi");
    render(<HowToPlay onClose={vi.fn()} />);
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByRole("heading", { level: 1, name: "How to play" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Push a tile" })).toBeTruthy();
  });
});
