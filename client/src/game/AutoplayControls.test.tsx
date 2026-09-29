// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { AutoplayPanel } from "./AutoplayControls.tsx";
import { PlayerStrip } from "./PlayerStrip.tsx";
import { TurnLine } from "./TurnLine.tsx";
import { seatView } from "../test/views.ts";

const seat = (n: number, name: string, autoplay = false) => seatView(n, name, { autoplay });

describe("autoplay › Autoplay shown to everyone", () => {
  it("Others see it: robot icon on Maija's chip and the turn line names her", () => {
    const seats = [seat(1, "Pekka"), seat(2, "Maija", true)];
    const { container } = render(<PlayerStrip view={{ seats }} />);
    expect(container.querySelector("[data-seat='2'][data-autoplay]")).not.toBeNull();
    expect(screen.getByText(/Maija.*botti pelaa hänen puolestaan/)).toBeTruthy();
    render(<TurnLine view={{ seats, turnSeat: 2, isMyTurn: false, turnAutoplay: true, mySeat: 1 }} />);
    expect(screen.getByText("Botti pelaa: Maija")).toBeTruthy();
  });

  it("Own view: the turn line says so and the panel offers taking back", () => {
    const seats = [seat(1, "Maija", true), seat(2, "Pekka")];
    render(<TurnLine view={{ seats, turnSeat: 1, isMyTurn: false, turnAutoplay: true, mySeat: 1 }} />);
    expect(screen.getByText("Botti pelaa puolestasi")).toBeTruthy();
    const onTakeBack = vi.fn();
    render(<AutoplayPanel pending={false} onTakeBack={onTakeBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Ota vuoro takaisin" }));
    expect(onTakeBack).toHaveBeenCalledOnce();
  });
});
