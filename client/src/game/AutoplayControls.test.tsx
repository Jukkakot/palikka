// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { AutoplayPanel } from "./AutoplayControls.tsx";
import { PlayerStrip } from "./PlayerStrip.tsx";
import { TurnLine } from "./TurnLine.tsx";

const seatView = (seat: number, name: string, autoplay = false) => ({
  seat,
  sessionId: `s${seat}`,
  name,
  connected: true,
  isMe: seat === 1,
  isBot: false,
  autoplay,
  square: { row: 0, col: 0 },
  cards: 6,
  found: [],
});

describe("autoplay › Autoplay shown to everyone", () => {
  it("Others see it: robot icon on Maija's chip and the turn line names her", () => {
    const seats = [seatView(1, "Pekka"), seatView(2, "Maija", true)];
    const { container } = render(<PlayerStrip view={{ seats }} />);
    expect(container.querySelector("[data-seat='2'][data-autoplay]")).not.toBeNull();
    expect(screen.getByText(/Maija.*botti pelaa hänen puolestaan/)).toBeTruthy();
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, step: "shift", turnAutoplay: true, mySeat: 1 }} />);
    expect(screen.getByText("Botti pelaa: Maija")).toBeTruthy();
  });

  it("Own view: the turn line says so and the panel offers taking back", () => {
    const seats = [seatView(1, "Maija", true), seatView(2, "Pekka")];
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: false, step: "shift", turnAutoplay: true, mySeat: 1 }} />);
    expect(screen.getByText("Botti pelaa puolestasi")).toBeTruthy();
    const onTakeBack = vi.fn();
    render(<AutoplayPanel pending={false} onTakeBack={onTakeBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Ota vuoro takaisin" }));
    expect(onTakeBack).toHaveBeenCalledOnce();
  });
});
