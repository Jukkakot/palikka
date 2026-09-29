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

const seatView = (seat: number, name: string) => ({
  seat,
  sessionId: `s${seat}`,
  name,
  connected: true,
  isMe: seat === 1,
  isBot: false,
  square: { row: 0, col: 0 },
  cards: 6,
  found: [],
});
const seats = [seatView(1, "Maija"), seatView(2, "Pekka")];

describe("board-view › Whose turn is shown", () => {
  it("Own turn: says it is your turn and to push a tile", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, step: "shift" }} />);
    expect(screen.getByText("Sinun vuorosi – työnnä laatta")).toBeTruthy();
  });

  it("Other player's turn: names Pekka with their pawn shape", () => {
    const { container } = render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "shift" }} />);
    expect(screen.getByText("Pekka työntää")).toBeTruthy();
    expect(container.querySelector("[data-seat='2']")).not.toBeNull();
    expect(container.querySelector("[data-me]")).toBeNull();
  });

  it("Own move step: says to move your pawn", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, step: "move" }} />);
    expect(screen.getByText("Sinun vuorosi – siirrä nappulaa")).toBeTruthy();
  });

  it("Other player's turn, moving: says Pekka is moving", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "move" }} />);
    expect(screen.getByText("Pekka siirtää")).toBeTruthy();
  });

  it("shows nothing before anybody holds the turn", () => {
    const { container } = render(<TurnLine view={{ seats, turnSeat: 0, isMyTurn: false, step: "shift" }} />);
    expect(container.textContent).toBe("");
  });
});

describe("board-view › Rejected command message", () => {
  it("REVERSE_PUSH_FORBIDDEN is explained without technical details", () => {
    render(<Notice message={i18n.t(noticeKey("REVERSE_PUSH_FORBIDDEN"))} />);
    expect(screen.getByRole("status").textContent).toBe("Et voi työntää laattaa takaisin samasta kohdasta");
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
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "shift", turnDeadline: Date.now() + 42_000 }} />);
    expect(screen.getByRole("timer").textContent).toBe("0:42");
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("timer").textContent).toBe("0:40");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Aikaa jäljellä 0:40");
  });

  it("the last 10 seconds are emphasised", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, step: "move", turnDeadline: Date.now() + 9_000 }} />);
    expect(screen.getByRole("timer").hasAttribute("data-urgent")).toBe(true);
  });

  it("Time up: 'Aika loppui' instead of the countdown", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "shift", turnDeadline: Date.now() + 3_000, turnExpired: true }} />);
    expect(screen.getByRole("timer").textContent).toBe("Aika loppui");
  });

  it("no clock, no timer", () => {
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: true, step: "shift", turnDeadline: 0 }} />);
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("Current player disconnected: the turn line says so", () => {
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "move", turnDisconnected: true }} />);
    expect(screen.getByText("Pekka – yhteys katkennut")).toBeTruthy();
  });

  it("clock skew never shows more than the limit or less than zero", () => {
    expect(secondsLeft(1_000 + 90_000, 1_000)).toBe(60);
    expect(secondsLeft(1_000, 5_000)).toBe(0);
    expect(secondsLeft(10_500, 1_000)).toBe(10);
    expect(formatSeconds(60)).toBe("1:00");
    expect(formatSeconds(7)).toBe("0:07");
  });
});

describe("board-view › Player progress shown › disconnected", () => {
  it("Disconnected player: dashed chip with an icon and accessible text", () => {
    const seat = (n: number, connected: boolean) => ({
      seat: n,
      sessionId: `s${n}`,
      name: n === 1 ? "Maija" : "Pekka",
      connected,
      isMe: n === 1,
      isBot: false,
      square: { row: 0, col: 0 },
      cards: 6,
      found: [],
    });
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
    const names = container.querySelectorAll("li > span[aria-hidden='true']:not([class*='count'])");
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
