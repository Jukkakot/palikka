// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { cellIndex, emptyBoard } from "@palikka/rules";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import type { GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { gameView, seatView } from "../test/views.ts";
import { GameScreen } from "./GameScreen.tsx";

/** Session parts the tests below do not look at. */
const extra = { setSpeed: vi.fn(), rematch: vi.fn(), rematching: false, watchBots: vi.fn(), nickname: () => "Maija" };

function sessionOf(overrides: Partial<GameSession> = {}) {
  const place = vi.fn<GameSession["place"]>(async () => ({ ok: true }));
  const leave = vi.fn<GameSession["leave"]>();
  const kick = vi.fn<GameSession["kick"]>(async () => ({ ok: true }));
  return { ...extra, place, kick, leave, pending: false, notice: undefined, ...overrides };
}

function setup(view: Partial<GameView> = {}, overrides: Partial<GameSession> = {}) {
  const session = sessionOf(overrides);
  const utils = render(<GameScreen view={gameView(view)} session={session} />);
  const rerender = (next: Partial<GameView>) => utils.rerender(<GameScreen view={gameView(next)} session={session} />);
  return { ...session, ...utils, rerender };
}

const cellButton = (row: number, col: number) => screen.getByRole("button", { name: `Vapaa ruutu: rivi ${row + 1}, sarake ${col + 1}` });
const board = () => document.querySelector("[data-board]")!;

describe("board-view › Claiming a square", () => {
  it("Own turn: every empty square is a button; tapping one sends it once", async () => {
    const { place } = setup();
    expect(board().querySelectorAll("button")).toHaveLength(400);
    await act(async () => {
      fireEvent.click(cellButton(2, 4));
    });
    expect(place).toHaveBeenCalledExactlyOnceWith({ row: 2, col: 4 });
  });

  it("claimed squares show their seat's colour and are not buttons", () => {
    const cells = [...emptyBoard()];
    cells[cellIndex({ row: 0, col: 0 })] = 2;
    setup({ board: cells });
    expect(board().querySelectorAll("button")).toHaveLength(399);
    expect(board().querySelector("[data-cell='0']")!.getAttribute("data-owner")).toBe("2");
  });

  it("Other player's turn: no buttons, the turn line names Pekka, Vihje disabled", () => {
    setup({ turnSeat: 2, isMyTurn: false });
    expect(board().querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByText("Pekka miettii…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Vihje" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("pending: the squares wait, and a rejection message is shown in words", () => {
    setup({}, { pending: true, notice: "errors.CELL_TAKEN" });
    expect((cellButton(0, 0) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Joku ehti ensin – ruutu on jo varattu")).toBeTruthy();
  });

  it("scores: every chip shows the seat's claimed squares", () => {
    setup({ seats: [seatView(1, "Maija", { score: 3 }), seatView(2, "Pekka", { score: 1 })] });
    const strip = screen.getByRole("list", { name: "Pelaajat ja pisteet" });
    expect(strip.querySelector("[data-seat='1']")!.textContent).toContain("3 ruutua");
    expect(strip.querySelector("[data-seat='2']")!.textContent).toContain("1 ruutu");
  });
});

describe("board-view › Hint", () => {
  it("Vihje rings a square and sends nothing", () => {
    const { place } = setup();
    expect(board().querySelector("[class*='hint']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vihje" }));
    expect(board().querySelectorAll("[class*='hint']")).toHaveLength(1);
    expect(place).not.toHaveBeenCalled();
  });
});

describe("board-view › Game result shown", () => {
  it("Viewer wins: the win line, no squares to tap, Pelaa uudelleen and Alkuun", () => {
    setup({ phase: "finished", finished: true, isMyTurn: false, winnerSeat: 1 });
    expect(screen.getByText("Voitit! Talvi on sinun.")).toBeTruthy();
    expect(board().querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Pelaa uudelleen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alkuun" })).toBeTruthy();
  });

  it("Someone else wins: named with their colour, and Alkuun leaves", () => {
    const { leave } = setup({ phase: "finished", finished: true, isMyTurn: false, winnerSeat: 2 });
    expect(screen.getByText("Pekka valtasi eniten ja voitti")).toBeTruthy();
    expect(document.querySelector("[data-winner-seat='2']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alkuun" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Pelaa uudelleen asks for the rematch and shows it pending", () => {
    const rematch = vi.fn();
    const finished = { phase: "finished", finished: true, isMyTurn: false, winnerSeat: 2 } as const;
    const { rerender } = render(<GameScreen view={gameView(finished)} session={sessionOf({ rematch })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pelaa uudelleen" }));
    expect(rematch).toHaveBeenCalledTimes(1);
    rerender(<GameScreen view={gameView(finished)} session={sessionOf({ rematch, rematching: true })} />);
    expect((screen.getByRole("button", { name: "Pelaa uudelleen" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("board-view › Kick control", () => {
  const slowPekka = { turnSeat: 2, isMyTurn: false, turnExpired: true, canKick: true };

  it("Offer after the time is up: 'Poista Pekka' instead of the controls", () => {
    setup(slowPekka);
    expect(screen.getByText("Pekka – aika loppui")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poista Pekka" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vihje" })).toBeNull();
  });

  it("Confirm before kicking: nothing is sent until Poista; Peru goes back", () => {
    const { kick } = setup(slowPekka);
    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    expect(screen.getByText("Poistetaanko Pekka pelistä?")).toBeTruthy();
    expect(kick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    fireEvent.click(screen.getByRole("button", { name: "Poista" }));
    expect(kick).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("Turn ends meanwhile: the confirmation disappears and nothing is sent", () => {
    const { rerender, kick } = setup({ ...slowPekka, turn: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    rerender({ turn: 5 });
    expect(screen.queryByText("Poistetaanko Pekka pelistä?")).toBeNull();
    expect(kick).not.toHaveBeenCalled();
  });
});

describe("board-view › Departures announced", () => {
  it("Someone leaves: 'Pekka lähti metsään' and their chip is gone", () => {
    const { rerender } = setup();
    rerender({ seats: [seatView(1, "Maija")] });
    expect(screen.getByText("Pekka lähti metsään – poistui pelistä")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Pelaajat ja pisteet" }).querySelector("[data-seat='2']")).toBeNull();
  });

  it("leaving a finished game is not announced", () => {
    const finished = { phase: "finished", finished: true, winnerSeat: 1 } as const;
    const { rerender } = setup(finished);
    rerender({ ...finished, seats: [seatView(1, "Maija")] });
    expect(screen.queryByText(/lähti metsään/)).toBeNull();
  });
});

describe("game-session › Leaving the game", () => {
  const leaveButton = () => screen.getByRole("button", { name: "Poistu pelistä" });

  it("Confirm before leaving: the question replaces the controls, and only Poistu leaves", () => {
    const { leave } = setup();
    fireEvent.click(leaveButton());
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByText(/Poistutaanko pelistä\?/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vihje" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Poistu" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Peru keeps the player in the game", () => {
    const { leave } = setup();
    fireEvent.click(leaveButton());
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Vihje" })).toBeTruthy();
  });

  it("Leaving a finished game: no confirmation", () => {
    const { leave } = setup({ phase: "finished", finished: true, winnerSeat: 2 });
    fireEvent.click(leaveButton());
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("the leave action is an icon button in the top bar", () => {
    setup();
    expect(leaveButton().closest("header")).not.toBeNull();
    expect(leaveButton().querySelector("svg.tabler-icon-door-exit")).not.toBeNull();
  });
});

describe("spectators › game screen", () => {
  const watched = (extraView: Partial<GameView> = {}) =>
    gameView({
      spectating: true,
      mySeat: undefined,
      isMyTurn: false,
      canAutoplay: false,
      spectators: 1,
      seats: [seatView(1, "Maija", { isMe: false }), seatView(2, "Kettu", { isMe: false, isBot: true })],
      ...extraView,
    });

  it("No controls: Katsot peliä instead of the squares and Vihje", () => {
    render(<GameScreen view={watched()} session={sessionOf()} />);
    expect(screen.getByText("Katsot peliä")).toBeTruthy();
    expect(board().querySelectorAll("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Vihje" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Bottien nopeus" })).toBeNull();
  });

  it("the eye count is shown to everyone; none without spectators", () => {
    const { unmount } = render(<GameScreen view={watched({ spectators: 2 })} session={sessionOf()} />);
    expect(screen.getByRole("img", { name: "Katsojia: 2" })).toBeTruthy();
    unmount();
    render(<GameScreen view={watched({ spectators: 0 })} session={sessionOf()} />);
    expect(screen.queryByRole("img", { name: /Katsojia/ })).toBeNull();
  });

  it("Spectator leaves at once, without a confirmation", () => {
    const leave = vi.fn();
    render(<GameScreen view={watched()} session={sessionOf({ leave })} />);
    fireEvent.click(screen.getByRole("button", { name: "Poistu pelistä" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Faster bots: only bots play, so the speed can be chosen", () => {
    const setSpeed = vi.fn<GameSession["setSpeed"]>(async () => ({ ok: true }));
    render(<GameScreen view={watched({ botOnly: true })} session={sessionOf({ setSpeed })} />);
    expect(screen.getByRole("button", { name: "1×" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "4×" }));
    expect(setSpeed).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("Watch another: a finished bot-only game offers Uusi bottipeli with the same count and speed", () => {
    const watchBots = vi.fn();
    render(<GameScreen view={watched({ botOnly: true, phase: "finished", finished: true, winnerSeat: 2 })} session={sessionOf({ watchBots })} />);
    expect(screen.getByText("Kettu valtasi eniten ja voitti")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pelaa uudelleen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Uusi bottipeli" }));
    expect(watchBots).toHaveBeenCalledExactlyOnceWith("Maija", 2, 1);
  });
});

describe("settings › Settings on the device (in the game)", () => {
  it("Settings during a game: the gear opens the settings and Takaisin returns to the board", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
    expect(document.querySelector("[data-board]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Asetukset" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(screen.queryByRole("heading", { name: "Asetukset" })).toBeNull();
    expect(document.querySelector("[data-board]")).not.toBeNull();
  });
});
