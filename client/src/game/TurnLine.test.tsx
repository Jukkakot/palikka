// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerStrip } from "./PlayerStrip.tsx";
import { formatSeconds, secondsLeft } from "./turnClock.ts";
import i18n from "../i18n";
import { noticeKey } from "../session/useGameSession.ts";
import { Notice } from "../ui/Notice.tsx";
import { TurnLine } from "./TurnLine.tsx";
import { seatView } from "../test/views.ts";

const seats = [seatView(1, "Maija"), seatView(2, "Pekka")];

describe("board-view › Whose turn is shown", () => {
  it("Own turn: says it is your turn", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true }} />);
    expect(screen.getByText("Sinun vuorosi")).toBeTruthy();
  });

  it("Other player's turn: names Pekka with their colour", () => {
    const { container } = render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false }} />);
    expect(screen.getByText("Pekka miettii…")).toBeTruthy();
    expect(container.querySelector("[data-seat='2']")).not.toBeNull();
    expect(container.querySelector("[data-me]")).toBeNull();
  });


  it("Second colour on turn: Tuplaväri names the colour before the text", () => {
    const double = [seatView(1, "Maija", { colours: [1, 3] }), seatView(2, "Pekka", { colours: [2, 4], isMe: false })];
    const { container } = render(<TurnLine view={{ seats: double, turnSeat: 1, turnColour: 3, isMyTurn: true, mySeat: 1, variant: "double" }} />);
    expect(screen.getByText("Puolukka · Sinun vuorosi")).toBeTruthy();
    expect(container.querySelector("[data-seat='3']")).not.toBeNull();
  });

  it("Shared colour on turn: says the shared colour is theirs to play", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, turnColour: 4, turnShared: true, isMyTurn: true, mySeat: 1, variant: "trio" }} />);
    expect(screen.getByText("Kuusi (yhteinen) · Sinun vuorosi")).toBeTruthy();
  });

  it("classic keeps the plain text", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, turnColour: 2, isMyTurn: false, variant: "classic" }} />);
    expect(screen.getByText("Pekka miettii…")).toBeTruthy();
  });

  it("shows nothing before anybody holds the turn", () => {
    const { container } = render(<TurnLine view={{ seats, turnSeat: 0, isMyTurn: false }} />);
    expect(container.textContent).toBe("");
  });
});

describe("board-view › Rejected command message", () => {
  it("OVERLAP is explained without technical details", () => {
    render(<Notice message={i18n.t(noticeKey("OVERLAP"))} />);
    expect(screen.getByRole("status").textContent).toBe("Joku ehti ensin – ruutu on jo varattu");
  });

  it("Server says not your turn", () => {
    render(<Notice message={i18n.t(noticeKey("NOT_YOUR_TURN"))} />);
    expect(screen.getByRole("status").textContent).toBe("Ei ole sinun vuorosi");
  });

  it("unknown codes get the generic message; the live region stays when empty", () => {
    expect(noticeKey("INVALID_COMMAND")).toBe("errors.generic");
    render(<Notice />);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("board-view › Whose turn is shown › turn clock", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  it("Countdown: shows 0:42 and keeps counting down", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, turnDeadline: Date.now() + 42_000 }} />);
    expect(screen.getByRole("timer").textContent).toBe("0:42");
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("timer").textContent).toBe("0:40");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Aikaa jäljellä 0:40");
  });

  it("the last 10 seconds are emphasised", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, turnDeadline: Date.now() + 9_000 }} />);
    expect(screen.getByRole("timer").hasAttribute("data-urgent")).toBe(true);
  });

  it("Time up: 'Aika loppui' instead of the countdown", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, turnDeadline: Date.now() + 3_000, turnExpired: true }} />);
    expect(screen.getByRole("timer").textContent).toBe("Aika loppui");
  });

  it("no clock, no timer", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, turnDeadline: 0 }} />);
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("Current player disconnected: the turn line says so", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, turnDisconnected: true }} />);
    expect(screen.getByText("Pekka – yhteys katkennut")).toBeTruthy();
  });

  it("clock skew never shows more than the limit or less than zero", () => {
    expect(secondsLeft(1_000 + 150_000, 1_000)).toBe(120);
    expect(secondsLeft(1_000, 5_000)).toBe(0);
    expect(secondsLeft(10_500, 1_000)).toBe(10);
    expect(formatSeconds(60)).toBe("1:00");
    expect(formatSeconds(7)).toBe("0:07");
  });
});

describe("board-view › Player progress shown › disconnected", () => {
  it("Disconnected player: dashed chip with an icon and accessible text", () => {
    const seat = (n: number, connected: boolean) => seatView(n, n === 1 ? "Maija" : "Pekka", { connected });
    const { container } = render(<PlayerStrip view={{ seats: [seat(1, true), seat(2, false)] }} />);
    const chip = container.querySelector("[data-seat='2']")!;
    expect(chip.hasAttribute("data-offline")).toBe(true);
    expect(chip.querySelector("svg.tabler-icon-wifi-off")).not.toBeNull();
    expect(chip.textContent).toContain("yhteys katkennut");
    expect(container.querySelector("[data-seat='1']")!.hasAttribute("data-offline")).toBe(false);
  });
});

describe("board-view › Player progress shown › names", () => {
  const long = ["Aaaaaaaaaaaaaaaa", "Bbbbbbbbbbbbbbbb", "Cccccccccccccccc", "Dddddddddddddddd"];
  const four = long.map((name, i) => seatView(i + 1, name));

  it("Long nickname: the full names are in the accessible text, the visible name is its own ellipsis span", () => {
    const { container } = render(<PlayerStrip view={{ seats: four }} />);
    long.forEach((name, i) => {
      const chip = container.querySelector(`[data-seat='${i + 1}']`)!;
      expect(chip.textContent).toContain(name);
    });
    const names = container.querySelectorAll("li > span[aria-hidden='true']:not([class*='count']):not([data-seat])");
    expect(names).toHaveLength(4);
  });

  it("the chip name is capped with an ellipsis so four chips fit 360 px", () => {
    // Resolved from this file, so the test runs from any working directory.
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "PlayerStrip.module.css"), "utf8");
    const rule = /\.name\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/max-width:\s*5\.5em/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/white-space:\s*nowrap/);
  });
});
