// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { FirstGameTips } from "./FirstGameTips.tsx";
import { TipsReset } from "./TipsReset.tsx";
import type { TipSituation } from "./tips.ts";

const myTurn: TipSituation = { playing: true, isMyTurn: true };

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("fi");
});
afterEach(() => localStorage.clear());

describe("first-game-tips › One-time tips in the first game", () => {
  it("First turn: the goal first, how to place after closing it", () => {
    render(<FirstGameTips {...myTurn} />);
    expect(screen.getByRole("status").textContent).toContain("Aseta palikoita laudalle");

    fireEvent.click(screen.getByRole("button", { name: "Sulje vinkki" }));
    expect(screen.getByRole("status").textContent).toContain("Napauta");
    expect(JSON.parse(localStorage.getItem("palikka.tips.seen")!)).toEqual(["goal", "place"]);
  });

  it("Shown only once: a new game after seeing a tip does not show it again", () => {
    render(<FirstGameTips {...myTurn} isMyTurn={false} />).unmount();
    render(<FirstGameTips {...myTurn} isMyTurn={false} />);
    expect(screen.getByRole("status").childElementCount).toBe(0);
  });

  it("Spectator: no tip", () => {
    render(<FirstGameTips {...myTurn} playing={false} />);
    expect(screen.getByRole("status").childElementCount).toBe(0);
  });
});

describe("first-game-tips › Show the tips again", () => {
  it("Nothing to reset: no link", () => {
    const { container } = render(<TipsReset />);
    expect(container.childElementCount).toBe(0);
  });

  it("Resetting the tips: the link turns into a confirmation and the tips are forgotten", () => {
    localStorage.setItem("palikka.tips.seen", '["goal"]');
    render(<TipsReset />);
    fireEvent.click(screen.getByRole("button", { name: "Näytä vinkit uudelleen" }));
    expect(screen.getByRole("status").textContent).toContain("seuraavassa pelissä");
    expect(localStorage.getItem("palikka.tips.seen")).toBeNull();
  });
});
