// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { FirstGameTips } from "./FirstGameTips.tsx";
import { TipsReset } from "./TipsReset.tsx";
import type { TipSituation } from "./tips.ts";

const myShift: TipSituation = { playing: true, isMyTurn: true, step: "shift", heading: "treasure" };

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("fi");
});
afterEach(() => localStorage.clear());

describe("first-game-tips › One-time tips in the first game", () => {
  it("First turn: target first, push after closing it, walk once the moment of push passes", () => {
    const { rerender } = render(<FirstGameTips {...myShift} />);
    expect(screen.getByRole("status").textContent).toContain("violetilla");

    fireEvent.click(screen.getByRole("button", { name: "Sulje vinkki" }));
    expect(screen.getByRole("status").textContent).toContain("napauta nuolta");

    rerender(<FirstGameTips {...myShift} step="move" />);
    expect(screen.getByRole("status").textContent).toContain("korostettua ruutua");
    expect(JSON.parse(localStorage.getItem("labyrinth.tips.seen")!)).toEqual(["target", "push", "walk"]);
  });

  it("Shown only once: a new game after seeing a tip does not show it again", () => {
    render(<FirstGameTips {...myShift} isMyTurn={false} />).unmount();
    render(<FirstGameTips {...myShift} isMyTurn={false} />);
    expect(screen.getByRole("status").childElementCount).toBe(0);
  });

  it("Spectator: no tip", () => {
    render(<FirstGameTips {...myShift} playing={false} />);
    expect(screen.getByRole("status").childElementCount).toBe(0);
  });
});

describe("first-game-tips › Show the tips again", () => {
  it("Nothing to reset: no link", () => {
    const { container } = render(<TipsReset />);
    expect(container.childElementCount).toBe(0);
  });

  it("Resetting the tips: the link turns into a confirmation and the tips are forgotten", () => {
    localStorage.setItem("labyrinth.tips.seen", '["target"]');
    render(<TipsReset />);
    fireEvent.click(screen.getByRole("button", { name: "Näytä vinkit uudelleen" }));
    expect(screen.getByRole("status").textContent).toContain("seuraavassa pelissä");
    expect(localStorage.getItem("labyrinth.tips.seen")).toBeNull();
  });
});
