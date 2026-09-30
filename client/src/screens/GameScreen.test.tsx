// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { checkPlacement, CLASSIC, newPosition, ORIENTATIONS, PIECE_SIZES } from "@palikka/rules";
import { placement, positionWith } from "@palikka/rules/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import type { GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { loadSettings, reloadSettings } from "../settings/settings.ts";
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

const board = () => document.querySelector("[data-board]")!;
const cell = (index: number) => board().querySelector(`[data-cell='${index}']`)!;
const piece = (id: string) => screen.getByRole("button", { name: new RegExp(`^Palikka ${id},`) }) as HTMLButtonElement;
const tray = () => screen.getByRole("list", { name: "Palikkasi" });

describe("piece-controls › Piece tray and placing", () => {
  it("Start of the game: 21 pieces, X5 dimmed on the first turn, the corner marked", () => {
    setup();
    expect(tray().querySelectorAll("li")).toHaveLength(21);
    expect(piece("X5").disabled).toBe(true);
    expect(piece("I5").disabled).toBe(false);
    expect(cell(0).className).toMatch(/corner/);
  });

  it("Placed piece: its slot is empty, the other pieces stay", () => {
    const position = positionWith([[1, placement("I1", ["#"], 0, 0)]], [1, 2]);
    setup({ position, board: position.cells });
    expect(tray().querySelector("[data-piece='I1']")!.hasAttribute("data-placed")).toBe(true);
    expect(tray().querySelectorAll("li")).toHaveLength(21);
    expect(cell(0).getAttribute("data-owner")).toBe("1");
  });

  it("Two taps on a phone: choose, tap, tap again sends the preview's move", async () => {
    const { place } = setup();
    fireEvent.click(piece("I5"));
    expect(piece("I5").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(cell(0));
    expect(cell(0).getAttribute("data-preview")).toBe("ok");
    expect(screen.getByText("Napauta palikkaa uudelleen tai paina Aseta")).toBeTruthy();
    expect(place).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(cell(0));
    });
    expect(place).toHaveBeenCalledTimes(1);
    const move = vi.mocked(place).mock.calls[0]![0];
    expect(PIECE_SIZES[move.piece]).toBe(5);
    expect(checkPlacement(gameView().position!, 1, move)).toBeUndefined();
  });

  it("Aseta sends the legal preview; disabled without one", async () => {
    const { place } = setup();
    const aseta = () => screen.getByRole("button", { name: "Aseta" }) as HTMLButtonElement;
    expect(aseta().disabled).toBe(true);
    fireEvent.click(piece("I5"));
    fireEvent.click(cell(1));
    expect(aseta().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(aseta());
    });
    expect(place).toHaveBeenCalledTimes(1);
  });

  it("Illegal: the reason shows and a tap inside sends nothing", () => {
    const { place } = setup();
    fireEvent.click(piece("I5"));
    fireEvent.click(cell(210));
    expect(cell(210).getAttribute("data-preview")).toBe("bad");
    expect(screen.getByText("Ensimmäisen palikan pitää peittää oma aloituskulmasi")).toBeTruthy();
    fireEvent.click(cell(210));
    expect(place).not.toHaveBeenCalled();
  });

  it("Keyboard: R turns the chosen piece", () => {
    setup();
    fireEvent.click(piece("L4"));
    const before = piece("L4").innerHTML;
    fireEvent.keyDown(window, { key: "r" });
    expect(piece("L4").innerHTML).not.toBe(before);
  });

  it("Other player's turn: tray and Vihje disabled, the turn line names Pekka", () => {
    setup({ turnSeat: 2, isMyTurn: false });
    expect(piece("I5").disabled).toBe(true);
    expect(screen.getByText("Pekka miettii…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Vihje" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("pending: the controls wait, and a rejection message is shown in words", () => {
    setup({}, { pending: true, notice: "errors.OVERLAP" });
    expect(piece("I5").disabled).toBe(true);
    expect(screen.getByText("Joku ehti ensin – ruutu on jo varattu")).toBeTruthy();
  });

  it("scores: every chip shows the seat's points, struck through once it cannot move", () => {
    setup({ seats: [seatView(1, "Maija", { score: -84 }), seatView(2, "Pekka", { score: 1, out: true })] });
    const strip = screen.getByRole("list", { name: "Pelaajat ja pisteet" });
    expect(strip.querySelector("[data-seat='1']")!.textContent).toContain("-84 pistettä");
    expect(strip.querySelector("[data-seat='2']")!.textContent).toContain("1 piste");
    expect(strip.querySelector("[data-seat='2']")!.hasAttribute("data-out")).toBe(true);
  });
});

describe("piece-controls › Hint as a preview", () => {
  it("Vihje puts the bot's move in a legal preview and sends nothing", () => {
    const { place } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Vihje" }));
    expect(cell(0).getAttribute("data-preview")).toBe("ok");
    expect(place).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Aseta" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("device-games › Undo against bots", () => {
  it("Peru shows only where it exists, is disabled with nothing to undo, and sends undo", () => {
    const undo = vi.fn<GameSession["undo"]>(async () => ({ ok: true }));
    const { rerender } = setup({ canUndo: true, undoable: false }, { undo });
    const button = () => screen.getByRole("button", { name: "Peru siirto" }) as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    rerender({ canUndo: true, undoable: true });
    fireEvent.click(button());
    expect(undo).toHaveBeenCalledTimes(1);
    rerender({ canUndo: false });
    expect(screen.queryByRole("button", { name: "Peru siirto" })).toBeNull();
  });
});

describe("board-view › Game result shown", () => {
  it("Viewer wins: the win line, no squares to tap, Pelaa uudelleen and Alkuun", () => {
    setup({ phase: "finished", finished: true, isMyTurn: false, winners: [1] });
    expect(screen.getByText("Voitit! Talvi on sinun.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Palikkasi" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pelaa uudelleen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alkuun" })).toBeTruthy();
  });

  it("result-screen › Result table: ranked rows under the winner line, no tray", () => {
    const results = [
      { seat: 2, colours: [2], shared: false, name: "Pekka", isMe: false, isBot: false, score: -3, squares: 86, piecesLeft: 1, left: false, winner: true, rank: 1 },
      { seat: 1, colours: [1], shared: false, name: "Maija", isMe: true, isBot: false, score: -10, squares: 79, piecesLeft: 3, left: false, winner: false, rank: 2 },
    ];
    setup({ phase: "finished", finished: true, isMyTurn: false, winners: [2], results });
    const table = screen.getByRole("table", { name: "Tulokset" });
    const rows = table.querySelectorAll("tbody tr");
    expect([...rows].map((r) => r.getAttribute("data-seat"))).toEqual(["2", "1"]);
    expect(rows[0]!.textContent).toContain("Pekka");
    expect(rows[0]!.textContent).toContain("-3");
    expect(rows[0]!.querySelector("[aria-label='Voittaja']")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Palikkasi" })).toBeNull();
  });

  it("result-screen › Two colours per player and the shared colour row", () => {
    const row = { isMe: false, isBot: false, squares: 80, piecesLeft: 2, left: false };
    const results = [
      { ...row, seat: 2, colours: [2, 4], shared: false, name: "Pekka", score: -13, winner: true, rank: 1 },
      { ...row, seat: 1, colours: [1, 3], shared: false, name: "Maija", isMe: true, score: -14, winner: false, rank: 2 },
      { ...row, seat: 0, colours: [4], shared: true, name: "", score: -1, winner: false, rank: 0 },
    ];
    setup({ phase: "finished", finished: true, isMyTurn: false, winners: [2], results });
    const rows = screen.getByRole("table", { name: "Tulokset" }).querySelectorAll("tbody tr");
    expect([...rows].map((r) => r.getAttribute("data-colours"))).toEqual(["2,4", "1,3", "4"]);
    expect(rows[0]!.querySelectorAll("[data-seat]")).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("-13");
    expect(rows[2]!.textContent).toContain("Yhteinen väri · ei lasketa");
    expect(rows[2]!.textContent).toContain("–");
    expect(rows[2]!.querySelector("[aria-label='Voittaja']")).toBeNull();
  });

  describe("game-motion › Celebration at the end", () => {
    afterEach(() => vi.unstubAllGlobals());
    const row = { colours: [1], shared: false, isBot: false, squares: 80, piecesLeft: 2, left: false };
    const won = [
      { ...row, seat: 1, name: "Maija", isMe: true, score: 15, winner: true, rank: 1 },
      { ...row, seat: 2, colours: [2], name: "Pekka", isMe: false, score: -12, winner: false, rank: 2 },
    ];
    const ended = (winners: number[], results = won) => ({ phase: "finished", finished: true, isMyTurn: false, winners, results }) as const;
    const motion = () => {
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
      vi.stubGlobal("requestAnimationFrame", () => 1);
      vi.stubGlobal("cancelAnimationFrame", () => {});
    };

    it("Viewer wins / Buttons usable at once: snow falls, the final scores are in the accessible text, buttons work", () => {
      motion();
      const { rerender, leave } = setup();
      rerender(ended([1]));
      expect(document.querySelector("[data-snowfall]")).toBeTruthy();
      const rows = screen.getByRole("table", { name: "Tulokset" }).querySelectorAll("tbody tr");
      expect(rows[0]!.querySelector("td:nth-of-type(2) [aria-hidden='true']")?.textContent).toBe("-12");
      expect(rows[0]!.textContent).toContain("15");
      fireEvent.click(screen.getByRole("button", { name: "Alkuun" }));
      expect(leave).toHaveBeenCalledTimes(1);
    });

    it("Viewer loses: no snowfall", () => {
      motion();
      const { rerender } = setup();
      rerender(ended([2], won.map((r) => ({ ...r, winner: r.seat === 2 }))));
      expect(document.querySelector("[data-snowfall]")).toBeNull();
    });

    it("No winner: no count-up and no snowfall", () => {
      motion();
      const { rerender } = setup();
      rerender(ended([], won.map((r) => ({ ...r, winner: false }))));
      expect(document.querySelector("[data-snowfall]")).toBeNull();
      expect(screen.getByRole("table", { name: "Tulokset" }).querySelector("[aria-hidden='true'] + span")).toBeNull();
    });

    it("a game already finished when opened: no celebration", () => {
      motion();
      setup(ended([1]));
      expect(document.querySelector("[data-snowfall]")).toBeNull();
    });
  });

  it("Someone else wins: named with their colour, and Alkuun leaves", () => {
    const { leave } = setup({ phase: "finished", finished: true, isMyTurn: false, winners: [2] });
    expect(screen.getByText("Pekka voitti – talvi on hänen")).toBeTruthy();
    expect(document.querySelector("[data-winner-seat='2']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alkuun" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Pelaa uudelleen asks for the rematch and shows it pending", () => {
    const rematch = vi.fn();
    const finished = { phase: "finished", finished: true, isMyTurn: false, winners: [2] } as const;
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
    const finished = { phase: "finished", finished: true, winners: [1] } as const;
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
    const { leave } = setup({ phase: "finished", finished: true, winners: [2] });
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
    expect(screen.queryByRole("list", { name: "Palikkasi" })).toBeNull();
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
    render(<GameScreen view={watched({ botOnly: true, phase: "finished", finished: true, winners: [2] })} session={sessionOf({ watchBots })} />);
    expect(screen.getByText("Kettu voitti – talvi on hänen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pelaa uudelleen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Uusi bottipeli" }));
    expect(watchBots).toHaveBeenCalledExactlyOnceWith("Maija", 2, 1, "classic");
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

describe("piece-controls › Phone layout (turned board, corner mode, zoom, hint steps)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    reloadSettings();
  });
  const phone = (matches: boolean) =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }));
  // Seat 2 (start corner top-right, square 19) on turn.
  const seat2 = () => {
    const position = { ...newPosition(CLASSIC, [1, 2], 1), turn: 2 };
    const seats = [seatView(1, "Maija", { isMe: false }), seatView(2, "Pekka", { isMe: true })];
    return { position, board: position.cells, seats, mySeat: 2, turnSeat: 2, turnColour: 2, trayColour: 2, myColours: [2] };
  };
  /** A shape as "row,col" keys, moved to the top-left. */
  const normalised = (cells: [number, number][]) => {
    const top = Math.min(...cells.map(([r]) => r));
    const left = Math.min(...cells.map(([, c]) => c));
    return cells.map(([r, c]) => `${r - top},${c - left}`).sort();
  };

  it("Seat 2 on a phone: the board is turned half a turn, the start corner at the bottom-left", () => {
    phone(true);
    setup(seat2());
    expect(board().getAttribute("data-turns")).toBe("2");
    // Screen order: the last row's first square is board square 19 (row 0, column 19).
    expect(board().children[19 * 20]!.getAttribute("data-cell")).toBe("19");
  });

  it("Wide screen: the same player's board is not turned, and there is no zoom toggle", () => {
    phone(false);
    setup(seat2());
    expect(board().hasAttribute("data-turns")).toBe(false);
    expect(screen.queryByRole("button", { name: "Koko lauta" })).toBeNull();
  });

  it("What you see is what you place: on a turned board the placed shape is the one the tray shows", async () => {
    phone(true);
    const { place } = setup(seat2());
    fireEvent.click(piece("L4"));
    fireEvent.click(screen.getByRole("button", { name: /Käännä/ }));
    const shown = normalised(
      [...piece("L4").querySelectorAll<HTMLElement>("span > span")].map((s) => [Number(s.style.gridRow) - 1, Number(s.style.gridColumn) - 1]),
    );
    fireEvent.click(cell(19));
    await act(async () => {
      fireEvent.click(cell(19));
    });
    expect(place).toHaveBeenCalledOnce();
    const move = vi.mocked(place).mock.calls[0]![0];
    // Where the move's squares are on screen (the view's order of the cells).
    const order = [...board().children].map((c) => Number(c.getAttribute("data-cell")));
    const onScreen = ORIENTATIONS[move.piece]![move.orientation]!.cells.map(([r, c]) => {
      const s = order.indexOf((move.row + r) * 20 + move.col + c);
      return [Math.floor(s / 20), s % 20] as [number, number];
    });
    expect(normalised(onScreen)).toEqual(shown);
  });

  it("Corner mode: tap a corner, the tray narrows, ‹ n/m › steps, Käännä returns on leaving", () => {
    phone(false);
    setup();
    fireEvent.click(cell(0));
    expect(screen.getByText("Nämä sopivat tähän kulmaan – valitse yksi")).toBeTruthy();
    expect(piece("X5").disabled).toBe(true);
    fireEvent.click(piece("L4"));
    expect(screen.getByText(/^1\/\d+$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Käännä/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Seuraava paikka tässä kulmassa" }));
    expect(screen.getByText(/^2\/\d+$/)).toBeTruthy();
    fireEvent.click(cell(210));
    expect(screen.getByRole("button", { name: /Käännä/ })).toBeTruthy();
    expect(piece("L4").getAttribute("aria-pressed")).toBe("true");
  });

  it("Vihje again: the button reads Vihje 2/3", () => {
    phone(false);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Vihje" }));
    expect(screen.getByRole("button", { name: "Vihje 1/3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vihje 1/3" }));
    expect(screen.getByRole("button", { name: "Vihje 2/3" })).toBeTruthy();
  });

  it("Zoom on turn, and Toggle off: the whole board from then on, remembered", () => {
    phone(true);
    setup(seat2());
    const frame = () => board().parentElement!;
    expect(frame().getAttribute("data-zoom")).toBe("10,0,10");
    fireEvent.click(screen.getByRole("button", { name: "Koko lauta" }));
    expect(frame().hasAttribute("data-zoom")).toBe(false);
    reloadSettings();
    expect(loadSettings().boardZoom).toBe(false);
  });
});
