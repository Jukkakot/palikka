// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../i18n";
import { seatView } from "../test/views.ts";
import { PlayerStrip } from "./PlayerStrip.tsx";

const seats = (out: number[] = []) => [1, 2, 3].map((n) => seatView(n, `P${n}`, { out: out.includes(n) }));
const chip = (container: HTMLElement, seat: number) => container.querySelector(`[data-seat='${seat}']`)!;

describe("game-motion › Turn and out in the player strip", () => {
  it("Turn moves: the turn mark goes from seat 1's chip to seat 2's; none once finished", () => {
    const { container, rerender } = render(<PlayerStrip view={{ seats: seats(), turnSeat: 1 }} />);
    expect(chip(container, 1).hasAttribute("data-turn")).toBe(true);
    rerender(<PlayerStrip view={{ seats: seats(), turnSeat: 2 }} />);
    expect(chip(container, 1).hasAttribute("data-turn")).toBe(false);
    expect(chip(container, 2).hasAttribute("data-turn")).toBe(true);
    rerender(<PlayerStrip view={{ seats: seats(), turnSeat: 2, finished: true }} />);
    expect(container.querySelector("[data-turn]")).toBeNull();
  });

  it("Seat goes out: it freezes on the transition and stays frosted", () => {
    const { container, rerender } = render(<PlayerStrip view={{ seats: seats(), turnSeat: 1 }} />);
    rerender(<PlayerStrip view={{ seats: seats([3]), turnSeat: 1 }} />);
    expect(chip(container, 3).hasAttribute("data-out")).toBe(true);
    expect(chip(container, 3).hasAttribute("data-freeze")).toBe(true);
    expect(chip(container, 3).textContent).toContain("ei enää siirtoja");
    rerender(<PlayerStrip view={{ seats: seats([3]), turnSeat: 2 }} />);
    expect(chip(container, 3).hasAttribute("data-out")).toBe(true);
    expect(chip(container, 1).hasAttribute("data-freeze")).toBe(false);
  });

  it("a seat already out at first sight is frosted without the freeze", () => {
    const { container } = render(<PlayerStrip view={{ seats: seats([3]), turnSeat: 1 }} />);
    expect(chip(container, 3).hasAttribute("data-out")).toBe(true);
    expect(chip(container, 3).hasAttribute("data-freeze")).toBe(false);
  });
});
