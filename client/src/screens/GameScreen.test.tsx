// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { hintTurn, homeTileId, insertionLine, isReachable, openings, reachableSquares, rotate, setupBoard, shiftBoard, square, squareIndex, TILE_SET, TREASURES, type Board, type TreasureId } from "@labyrinth/rules";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { botViewOf } from "../game/hint.ts";
import { SpareTile } from "../game/SpareTile.tsx";
import { DEFAULT_SETTINGS, updateSettings } from "../settings/settings.ts";
import type { GameSession } from "../session/useGameSession.ts";
import { toGameView, type SyncedState } from "../session/viewModel.ts";
import { GameScreen } from "./GameScreen.tsx";

const board = setupBoard(7);
const testBoard = board;

/** Session parts the tests below do not look at. */
const extra = { setSpeed: vi.fn(), rematch: vi.fn(), rematching: false, watchBots: vi.fn(), nickname: () => "Maija" };

interface Turn {
  turnSeat?: number;
  lastInsertion?: string;
  phase?: string;
  /** My pawn square (default: my start corner). */
  mine?: { row: number; col: number };
  /** Extra synced fields of my player and of player 2 (cards, found, target). */
  me?: object;
  other?: object;
  winnerSeat?: number;
  turnDeadline?: number;
  turnExpired?: boolean;
  /** Player 2 has left: only my seat remains. */
  otherGone?: boolean;
  /** The synced board (default: the test board). */
  board?: Board;
}

function view(turn: Turn = {}) {
  const board = turn.board ?? testBoard;
  const state: SyncedState = {
    squares: board.squares.map(({ id, rotation }) => ({ id, rotation })),
    spare: { id: board.spare.id, rotation: board.spare.rotation },
    players: new Map([
      ["me", { seat: 1, name: "Maija", connected: true, ...(turn.mine ?? { row: 0, col: 0 }), ...turn.me }],
      ...(turn.otherGone ? [] : [["other", { seat: 2, name: "Pekka", connected: true, ...turn.other }] as const]),
    ]),
    turnSeat: turn.turnSeat ?? 1,
    lastInsertion: turn.lastInsertion ?? "",
    phase: turn.phase ?? "shift",
    winnerSeat: turn.winnerSeat ?? 0,
    turnDeadline: turn.turnDeadline ?? 0,
    turnExpired: turn.turnExpired ?? false,
  };
  return toGameView(state, "brave-otters-sing", "me")!;
}

function setup(turn?: Turn, session: Partial<GameSession> = {}) {
  const shift = vi.fn<GameSession["shift"]>(async () => ({ ok: true }));
  const move = vi.fn<GameSession["move"]>(async () => ({ ok: true }));
  const leave = vi.fn<GameSession["leave"]>();
  const kick = vi.fn<GameSession["kick"]>(async () => ({ ok: true }));
  const utils = render(<GameScreen view={view(turn)} session={{ ...extra, shift, move, kick, leave, pending: false, ...extra, ...session }} />);
  return { shift, move, kick, leave, ...utils };
}

/** Where the board draws a tile: its translate in board units. */
function tilePosition(container: HTMLElement, id: number) {
  const g = container.querySelector<SVGGElement>(`[aria-label="Pelilauta"] [data-tile-id="${id}"]`);
  return g?.style.transform;
}
const at = (row: number, col: number) => `translate(${col * 100}px, ${row * 100}px)`;

const arrow = (name: string) => screen.getByRole("button", { name });

describe("board-view › Shift controls", () => {
  it("Preview then confirm: N3 previews column 4 moved down, Työnnä sends once", async () => {
    const { container, shift } = setup();
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 4"));

    expect(tilePosition(container, board.spare.id)).toBe(at(0, 3));
    const before = board.squares[squareIndex(square(2, 3))]!;
    expect(tilePosition(container, before.id)).toBe(at(3, 3));
    const outgoing = board.squares[squareIndex(square(6, 3))]!;
    expect(tilePosition(container, outgoing.id)).toBeUndefined();
    expect(screen.getByRole("group", { name: "Tippuu pois" })).toBeTruthy();
    expect(shift).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Työnnä" }));
    });
    expect(shift).toHaveBeenCalledTimes(1);
    expect(shift).toHaveBeenCalledWith("N3", board.spare.rotation);
  });

  it("tapping the selected arrow again confirms", async () => {
    const { shift } = setup();
    fireEvent.click(arrow("Työnnä vasemmalta riviin 2"));
    await act(async () => {
      fireEvent.click(arrow("Työnnä vasemmalta riviin 2"));
    });
    expect(shift).toHaveBeenCalledExactlyOnceWith("W1", board.spare.rotation);
  });

  it("Change of mind: N3 then W1 previews W1 and sends nothing; Peru restores the board", () => {
    const { container, shift } = setup();
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 4"));
    fireEvent.click(arrow("Työnnä vasemmalta riviin 2"));

    expect(tilePosition(container, board.spare.id)).toBe(at(1, 0));
    const expected = shiftBoard(board, "W1", board.spare.rotation).board;
    expected.squares.forEach((tile, i) => {
      expect(tilePosition(container, tile.id)).toBe(at(Math.floor(i / 7), i % 7));
    });
    expect(shift).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(tilePosition(container, board.spare.id)).toBeUndefined();
    expect(screen.getByText("Valitse nuoli laudan reunalta")).toBeTruthy();
  });

  it("Rotate the spare twice: shown turned 180°, inserted with rotation + 180°", async () => {
    const { container, shift } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Käännä laattaa" }));
    fireEvent.click(screen.getByRole("button", { name: "Käännä laattaa" }));

    const turned = rotate(board.spare, 2);
    const spare = screen.getByRole("group", { name: "Ylimääräinen laatta" });
    expect(spare.querySelector("[data-tile-id]")?.getAttribute("data-openings")).toBe(openings(turned).join(""));

    fireEvent.click(arrow("Työnnä oikealta riviin 4"));
    const inserted = container.querySelector(`[aria-label="Pelilauta"] [data-tile-id="${board.spare.id}"]`);
    expect(inserted?.getAttribute("data-openings")).toBe(openings(turned).join(""));
    expect(inserted?.querySelector("[data-highlight]")).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Työnnä" }));
    });
    expect(shift).toHaveBeenCalledWith("E3", turned.rotation);
  });

  it("offers exactly 12 arrows on your turn", () => {
    const { container } = setup();
    expect(container.querySelectorAll("[data-insertion]")).toHaveLength(12);
  });

  it("keyboard: Enter selects an arrow", () => {
    const { container } = setup();
    fireEvent.keyDown(arrow("Työnnä alhaalta sarakkeeseen 6"), { key: "Enter" });
    expect(tilePosition(container, board.spare.id)).toBe(at(6, 5));
  });
});

describe("board-view › Tiles slide", () => {
  it("Someone shifts: tiles keep their element and get a new position; the preview gives way to the synced board", () => {
    const { container, rerender, shift } = setup();
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 2"));
    const moving = board.squares[squareIndex(square(0, 1))]!;
    const element = container.querySelector(`[data-tile-id="${moving.id}"]`);

    const after = shiftBoard(board, "N5", board.spare.rotation).board;
    const synced = toGameView(
      {
        squares: after.squares.map(({ id, rotation }) => ({ id, rotation })),
        spare: { id: after.spare.id, rotation: after.spare.rotation },
        players: new Map([["me", { seat: 1, name: "Maija", connected: true }]]),
        turnSeat: 1,
        lastInsertion: "N5",
      },
      "brave-otters-sing",
      "me",
    )!;
    rerender(<GameScreen view={synced} session={{ ...extra, shift, move: vi.fn(), kick: vi.fn(), leave: vi.fn(), pending: false, ...extra }} />);

    // The N1 preview is gone; the board is the synced one.
    expect(tilePosition(container, moving.id)).toBe(at(0, 1));
    const slid = board.squares[squareIndex(square(0, 5))]!;
    expect(tilePosition(container, slid.id)).toBe(at(1, 5));
    expect(container.querySelector(`[data-tile-id="${moving.id}"]`)).toBe(element);
    expect(element?.getAttribute("class")).toMatch(/slide/);
  });
});

describe("board-view › Forbidden reverse shown", () => {
  it("After N1: the S1 arrow is disabled and tapping it does nothing", () => {
    const { container, shift } = setup({ lastInsertion: "N1" });
    const s1 = container.querySelector("[data-insertion='S1']")!;
    expect(s1.getAttribute("aria-disabled")).toBe("true");
    expect(s1.getAttribute("aria-label")).toContain("ei sallittu");

    fireEvent.click(s1);
    expect(tilePosition(container, board.spare.id)).toBeUndefined();
    expect(shift).not.toHaveBeenCalled();
    expect(container.querySelector("[data-insertion='N1']")!.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("board-view › Whose turn is shown (game screen)", () => {
  it("Other player's turn: no arrows, rotate disabled, turn line names player 2", () => {
    const { container } = setup({ turnSeat: 2 });
    expect(container.querySelectorAll("[data-insertion]")).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Käännä laattaa" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Pekka työntää")).toBeTruthy();
    expect(screen.queryByText("Valitse nuoli laudan reunalta")).toBeNull();
  });
});

describe("board-view › Rejected command message", () => {
  it("pending: arrows and buttons wait, and a rejection message is shown in words", () => {
    const { container } = setup({}, { pending: true, notice: "errors.NOT_YOUR_TURN" });
    expect(container.querySelector("[data-insertion='N1']")!.getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByRole("button", { name: "Käännä laattaa" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Ei ole sinun vuorosi").closest("[role=status]")).not.toBeNull();
  });

  it("a rejected shift drops the preview", async () => {
    const { container } = setup({}, { shift: vi.fn(async () => ({ ok: false as const, code: "NOT_YOUR_TURN" })) });
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 2"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Työnnä" }));
    });
    expect(tilePosition(container, board.spare.id)).toBeUndefined();
  });
});

const pawnOf = (name: string) => screen.getByRole("img", { name }).style.transform;

describe("board-view › Pawns on their squares (game screen)", () => {
  it("Preview carries a pawn: N3 shows the pawn on (2,3) at (3,3)", () => {
    setup({ mine: { row: 2, col: 3 } });
    expect(pawnOf("Maija (sinä)")).toBe(at(2, 3));
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 4"));
    expect(pawnOf("Maija (sinä)")).toBe(at(3, 3));
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(pawnOf("Maija (sinä)")).toBe(at(2, 3));
  });
});

describe("board-view › Move controls", () => {
  const reach = reachableSquares(board, square(0, 0));
  const target = reach.at(-1)!;
  const moveTargets = (container: HTMLElement) => container.querySelectorAll("[data-move-target]");

  it("the test board has somewhere to go from the top-left corner", () => {
    expect(reach.length).toBeGreaterThan(1);
  });

  it("Tap to move: every reachable square is a target; tapping one sends the move once", async () => {
    const { container, move, shift } = setup({ phase: "move" });
    expect(moveTargets(container)).toHaveLength(reach.length);
    expect(container.querySelectorAll("[data-insertion]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Käännä laattaa" })).toBeNull();
    expect(screen.getByText("Sinun vuorosi – siirrä nappulaa")).toBeTruthy();

    await act(async () => {
      fireEvent.click(container.querySelector(`[data-move-target="${target.row},${target.col}"]`)!);
    });
    expect(move).toHaveBeenCalledExactlyOnceWith(target);
    expect(shift).not.toHaveBeenCalled();
  });

  it("Stay: the button and the own square both send the own square", async () => {
    const { container, move } = setup({ phase: "move" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Jää paikalleen" }));
    });
    expect(move).toHaveBeenLastCalledWith({ row: 0, col: 0 });
    await act(async () => {
      fireEvent.click(container.querySelector(`[data-move-target="0,0"]`)!);
    });
    expect(move).toHaveBeenCalledTimes(2);
    expect(move).toHaveBeenLastCalledWith({ row: 0, col: 0 });
  });

  it("Unreachable square: no target there, so tapping it sends nothing", () => {
    const { container, move } = setup({ phase: "move" });
    const unreachable = [...Array(49).keys()].map((i) => square(Math.floor(i / 7), i % 7)).find((sq) => !isReachable(board, square(0, 0), sq))!;
    expect(container.querySelector(`[data-move-target="${unreachable.row},${unreachable.col}"]`)).toBeNull();
    fireEvent.click(container.querySelector(`[data-tile-id="${board.squares[squareIndex(unreachable)]!.id}"]`)!);
    expect(move).not.toHaveBeenCalled();
  });

  it("Not during the shift: no squares are highlighted", () => {
    const { container } = setup();
    expect(moveTargets(container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Jää paikalleen" })).toBeNull();
  });

  it("pending: move targets and Stay wait", () => {
    const { container, move } = setup({ phase: "move" }, { pending: true });
    expect(moveTargets(container)[0]!.getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByRole("button", { name: "Odotetaan palvelinta…" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(moveTargets(container)[1] ?? moveTargets(container)[0]!);
    expect(move).not.toHaveBeenCalled();
  });

  it("Other player's move step: no targets, no Stay, turn line says player 2 is moving", () => {
    const { container } = setup({ phase: "move", turnSeat: 2 });
    expect(moveTargets(container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Jää paikalleen" })).toBeNull();
    expect(screen.getByText("Pekka siirtää")).toBeTruthy();
  });
});

const ALL_FOUND = TREASURES.slice(0, 6);
const tileOnBoard = (id: number) => document.querySelector(`[aria-label="Pelilauta"] [data-tile-id="${id}"]`);
/** A treasure whose tile is on the test board, and one carried by the spare (the test board's spare may have none). */
const boardTreasure = TILE_SET.find((t) => t.treasure && t.id !== board.spare.id)!.treasure!;

describe("board-view › Own target highlighted", () => {
  it("Target on the board: its tile is marked as the target with its name", () => {
    setup({ me: { cards: 6, found: [], target: boardTreasure } });
    const tile = tileOnBoard(TILE_SET.find((t) => t.treasure === boardTreasure)!.id)!;
    expect(tile.getAttribute("data-target")).toBe("treasure");
    expect(document.querySelectorAll("[data-target='treasure']").length).toBeGreaterThanOrEqual(1);
  });

  it("Target on the spare: the spare tile carrying the target is ringed", () => {
    const withTreasure = TILE_SET.find((t) => t.treasure && !t.fixed)!;
    render(<SpareTile tile={{ id: withTreasure.id, kind: withTreasure.kind, rotation: 0 }} target={{ tileId: withTreasure.id, home: false }} />);
    const spare = screen.getByRole("group", { name: "Ylimääräinen laatta" });
    expect(spare.querySelector("[data-target='treasure']")).toBeTruthy();
    expect(screen.getByRole("img", { name: `Kohteesi: ${i18n.t(`treasures.${withTreasure.treasure!}`)}` })).toBeTruthy();
  });

  it("Heading home: the start corner is marked with the home badge", () => {
    setup({ me: { cards: 6, found: ALL_FOUND, target: "" } });
    expect(tileOnBoard(homeTileId(1))!.getAttribute("data-target")).toBe("home");
    expect(screen.getByRole("img", { name: "Kotiruutusi – palaa tänne voittaaksesi" })).toBeTruthy();
  });

  it("other players' targets are never marked", () => {
    setup({ me: { cards: 6, found: [] }, other: { cards: 6, found: [], target: boardTreasure } });
    expect(document.querySelectorAll("[data-tile-id][data-target]")).toHaveLength(0);
  });
});

describe("board-view › Player progress shown", () => {
  it("Progress strip: seat 1 with 2/6 and the dragon, seat 2 with 0/6 and no target", () => {
    setup({ me: { cards: 6, found: ["crown", "key"], target: "dragon" }, other: { cards: 6, found: [] } });
    const strip = screen.getByRole("list", { name: "Pelaajat ja löydetyt aarteet" });
    const [mine, theirs] = [...strip.querySelectorAll("li")];
    expect(mine!.textContent).toContain("2/6");
    expect(mine!.textContent).toContain("kohde: lohikäärme");
    expect(mine!.querySelector("[data-target='dragon']")).toBeTruthy();
    expect(theirs!.textContent).toContain("0/6");
    expect(theirs!.querySelector("[data-target]")).toBeNull();
  });
});

describe("board-view › Collected treasure announced", () => {
  it("Viewer collects: a short message names the treasure and the highlight moves on", () => {
    const before = { cards: 6, found: [] as TreasureId[], target: "dragon" };
    const { rerender, leave, shift, move } = setup({ me: before });
    const next = view({ me: { cards: 6, found: ["dragon"], target: boardTreasure } });
    rerender(<GameScreen view={next} session={{ ...extra, shift, move, kick: vi.fn(), leave, pending: false, ...extra }} />);
    expect(screen.getByText("Löysit: lohikäärme")).toBeTruthy();
    expect(tileOnBoard(TILE_SET.find((t) => t.treasure === boardTreasure)!.id)!.getAttribute("data-target")).toBe("treasure");
  });

  it("another player's collection only updates their count", () => {
    const { rerender, leave, shift, move } = setup({ me: { cards: 6, found: [] }, other: { cards: 6, found: [] } });
    rerender(<GameScreen view={view({ me: { cards: 6, found: [] }, other: { cards: 6, found: ["cat"] } })} session={{ ...extra, shift, move, kick: vi.fn(), leave, pending: false, ...extra }} />);
    expect(screen.queryByText(/Löysit/)).toBeNull();
    expect(screen.getByRole("list", { name: "Pelaajat ja löydetyt aarteet" }).textContent).toContain("1/6");
  });
});

describe("board-view › Game result shown", () => {
  const finished = (winnerSeat: number) => ({ phase: "finished", winnerSeat, me: { cards: 6, found: ALL_FOUND, target: "" } });

  it("Viewer wins: Voitit!, no controls, Pelaa uudelleen and Alkuun", () => {
    const { container } = setup(finished(1));
    expect(screen.getByText("Voitit!")).toBeTruthy();
    expect(container.querySelectorAll("[data-insertion]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-move-target]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Käännä laattaa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Jää paikalleen" })).toBeNull();
    expect(container.querySelectorAll("[data-tile-id][data-target]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Pelaa uudelleen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alkuun" })).toBeTruthy();
  });

  it("Someone else wins: Pekka voitti with their pawn, and Alkuun leaves", () => {
    const { leave } = setup(finished(2));
    expect(screen.getByText("Pekka voitti")).toBeTruthy();
    expect(document.querySelector("[data-winner-seat='2']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Alkuun" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });
});

describe("board-view › Kick control", () => {
  it("Offer after the time is up: the viewer sees 'Poista Pekka' instead of the step controls", () => {
    // The viewer is seat 1 in these helpers, so make seat 2 the slow one.
    setup({ turnSeat: 2, turnDeadline: Date.now() - 1, turnExpired: true });
    expect(screen.getByText("Pekka – aika loppui")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poista Pekka" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Käännä laattaa" })).toBeNull();
  });

  it("Confirm before kicking: nothing is sent until Poista; Peru goes back", () => {
    const { kick } = setup({ turnSeat: 2, turnExpired: true });
    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    expect(screen.getByText("Poistetaanko Pekka pelistä?")).toBeTruthy();
    expect(kick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(screen.getByRole("button", { name: "Poista Pekka" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    fireEvent.click(screen.getByRole("button", { name: "Poista" }));
    expect(kick).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("Not for the slow player: their own step controls stay", () => {
    setup({ turnSeat: 1, turnExpired: true });
    expect(screen.queryByRole("button", { name: /Poista pelaaja/ })).toBeNull();
    expect(screen.getByText("Aika loppui")).toBeTruthy();
  });

  it("not before the time is up", () => {
    setup({ turnSeat: 2, turnDeadline: Date.now() + 30_000 });
    expect(screen.queryByRole("button", { name: /Poista pelaaja/ })).toBeNull();
  });

  it("Turn ends meanwhile: the confirmation disappears and nothing is sent", () => {
    const { rerender, kick, shift, move, leave } = setup({ turnSeat: 2, turnExpired: true });
    fireEvent.click(screen.getByRole("button", { name: "Poista Pekka" }));
    rerender(<GameScreen view={view({ turnSeat: 1, turnDeadline: Date.now() + 60_000 })} session={{ ...extra, shift, move, kick, leave, pending: false, ...extra }} />);
    expect(screen.queryByText("Poistetaanko Pekka pelistä?")).toBeNull();
    expect(kick).not.toHaveBeenCalled();
  });
});

describe("board-view › Departures announced", () => {
  it("Someone leaves: 'Pekka poistui pelistä' and their chip is gone", () => {
    const { rerender, kick, shift, move, leave } = setup();
    rerender(<GameScreen view={view({ otherGone: true })} session={{ ...extra, shift, move, kick, leave, pending: false, ...extra }} />);
    expect(screen.getByText("Pekka poistui pelistä")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Pelaajat ja löydetyt aarteet" }).querySelector("[data-seat='2']")).toBeNull();
  });

  it("leaving a finished game is not announced", () => {
    const { rerender, kick, shift, move, leave } = setup({ phase: "finished", winnerSeat: 1 });
    rerender(<GameScreen view={view({ phase: "finished", winnerSeat: 1, otherGone: true })} session={{ ...extra, shift, move, kick, leave, pending: false, ...extra }} />);
    expect(screen.queryByText("Pekka poistui pelistä")).toBeNull();
  });
});

describe("game-session › Leaving the game", () => {
  const leaveButton = () => screen.getByRole("button", { name: "Poistu pelistä" });

  it("Confirm before leaving: the question replaces the controls, and only Poistu leaves", () => {
    const { leave } = setup();
    fireEvent.click(leaveButton());
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByText("Poistutaanko pelistä? Nappulasi ja aarteesi poistuvat pelistä.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Käännä laattaa" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Poistu" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Peru keeps the player in the game", () => {
    const { leave } = setup();
    fireEvent.click(leaveButton());
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Käännä laattaa" })).toBeTruthy();
  });

  it("Leaving a finished game: no confirmation", () => {
    const { leave } = setup({ phase: "finished", winnerSeat: 2 });
    fireEvent.click(leaveButton());
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("the leave action is a 44 px icon button in the top bar", () => {
    setup();
    expect(leaveButton().closest("header")).not.toBeNull();
    expect(leaveButton().querySelector("svg.tabler-icon-door-exit")).not.toBeNull();
  });
});

describe("spectators › game screen", () => {
  /** A game seen by a spectator: seat 1 Maija (or a bot) and seat 2 Robo, both targets known. */
  function watched(opts: { botOnly?: boolean; phase?: string; winnerSeat?: number; spectators?: number } = {}) {
    const state: SyncedState = {
      squares: board.squares.map(({ id, rotation }) => ({ id, rotation })),
      spare: { id: board.spare.id, rotation: board.spare.rotation },
      players: new Map([
        ["a", { seat: 1, name: opts.botOnly ? "Pixel" : "Maija", bot: opts.botOnly, connected: true, row: 0, col: 0, cards: 6, found: [], target: "dragon" }],
        ["bot:2", { seat: 2, name: "Robo", bot: true, connected: true, row: 0, col: 6, cards: 6, found: [], target: "key" }],
      ]),
      turnSeat: 1,
      phase: opts.phase ?? "shift",
      winnerSeat: opts.winnerSeat ?? 0,
      spectators: opts.spectators ?? 1,
      botSpeed: 1,
    };
    return toGameView(state, "brave-otters-sing", "spectator")!;
  }
  const session = (overrides: Partial<GameSession> = {}) => ({
    ...extra,
    shift: vi.fn(),
    move: vi.fn(),
    kick: vi.fn(),
    leave: vi.fn(),
    pending: false,
    ...overrides,
  });

  it("No controls: Katsot peliä instead of arrows and spare controls; every target in the strip", () => {
    const { container } = render(<GameScreen view={watched()} session={session()} />);
    expect(screen.getByText("Katsot peliä")).toBeTruthy();
    expect(container.querySelectorAll("[data-insertion]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Käännä laattaa" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Bottien nopeus" })).toBeNull();
    expect([...container.querySelectorAll("[data-target]")].map((e) => e.getAttribute("data-target"))).toEqual(
      expect.arrayContaining(["dragon", "key"]),
    );
  });

  it("Someone starts watching: the eye count is shown to everyone; none without spectators", () => {
    const { unmount } = render(<GameScreen view={watched({ spectators: 2 })} session={session()} />);
    expect(screen.getByRole("img", { name: "Katsojia: 2" })).toBeTruthy();
    unmount();
    render(<GameScreen view={watched({ spectators: 0 })} session={session()} />);
    expect(screen.queryByRole("img", { name: /Katsojia/ })).toBeNull();
  });

  it("Spectator leaves at once, without a confirmation", () => {
    const leave = vi.fn();
    render(<GameScreen view={watched()} session={session({ leave })} />);
    fireEvent.click(screen.getByRole("button", { name: "Poistu pelistä" }));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Faster bots: only bots play, so the speed can be chosen", () => {
    const setSpeed = vi.fn<GameSession["setSpeed"]>(async () => ({ ok: true }));
    render(<GameScreen view={watched({ botOnly: true })} session={session({ setSpeed })} />);
    expect(screen.getByRole("button", { name: "1×" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "4×" }));
    expect(setSpeed).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("Watch another: a finished bot-only game offers Uusi bottipeli with the same count and speed", () => {
    const watchBots = vi.fn();
    render(<GameScreen view={watched({ botOnly: true, phase: "finished", winnerSeat: 2 })} session={session({ watchBots })} />);
    expect(screen.getByText("Robo voitti")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pelaa uudelleen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Uusi bottipeli" }));
    expect(watchBots).toHaveBeenCalledExactlyOnceWith("Maija", 2, 1);
  });

  it("a player's finished game: Pelaa uudelleen asks for the rematch and shows it pending", () => {
    const rematch = vi.fn();
    const { rerender } = render(<GameScreen view={view({ phase: "finished", winnerSeat: 2 })} session={session({ rematch })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pelaa uudelleen" }));
    expect(rematch).toHaveBeenCalledTimes(1);
    rerender(<GameScreen view={view({ phase: "finished", winnerSeat: 2 })} session={session({ rematch, rematching: true })} />);
    expect((screen.getByRole("button", { name: "Pelaa uudelleen" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("board-view › Reach shown in the shift preview", () => {
  it("Preview opens a corridor: N3 marks every square reachable on the previewed board; Peru removes them", () => {
    const { container } = setup();
    fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 4"));
    const previewed = shiftBoard(board, "N3", board.spare.rotation, [square(0, 0), square(0, 6)]);
    const expected = reachableSquares(previewed.board, previewed.pawns[0]!);
    const marks = [...container.querySelectorAll("[data-reach]")].map((el) => el.getAttribute("data-reach"));
    expect(marks).toEqual(expected.map((sq) => `${sq.row},${sq.col}`));
    expect(screen.getByRole("img", { name: new RegExp(`${expected.length} ruutua|Vain oma ruutusi`) })).toBeTruthy();
    // Not tappable: no move buttons appear during the preview.
    expect(container.querySelector("[data-move-target]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(container.querySelector("[data-reach]")).toBeNull();
  });
});

describe("board-view › Last turn shown (game screen)", () => {
  it("Bot shifts and walks: push marked at the board edge and route drawn in seat 2's colour; own preview hides them", () => {
    const corners = [square(0, 0), square(0, 6)];
    const shifted = shiftBoard(board, "N3", 0, corners);
    const from = shifted.pawns[1]!;
    const to = reachableSquares(shifted.board, from).find((sq) => sq.row !== from.row || sq.col !== from.col)!;
    const { container, rerender } = setup({ turnSeat: 2 });
    const show = (turn: Turn) =>
      rerender(<GameScreen view={view(turn)} session={{ ...extra, shift: vi.fn(), move: vi.fn(), kick: vi.fn(), leave: vi.fn(), pending: false }} />);
    show({ board: shifted.board, turnSeat: 2, phase: "move", lastInsertion: "N3", mine: shifted.pawns[0], other: { row: from.row, col: from.col } });
    show({ board: shifted.board, turnSeat: 1, phase: "shift", lastInsertion: "N3", mine: shifted.pawns[0], other: { row: to.row, col: to.col } });

    const push = container.querySelector("[data-push]");
    expect(push?.getAttribute("data-push")).toBe("N3");
    expect(push?.getAttribute("data-look")).toBe("2");
    expect(container.querySelector("[data-route-start]")).toBeTruthy();
    expect(container.querySelector("[data-route-end]")).toBeTruthy();
    const route = container.querySelector("[data-route]")?.getAttribute("data-route")?.split(" ");
    expect(route?.[0]).toBe(`${from.row},${from.col}`);
    expect(route?.at(-1)).toBe(`${to.row},${to.col}`);

    fireEvent.click(arrow("Työnnä vasemmalta riviin 2"));
    expect(container.querySelector("[data-route]")).toBeNull();
    expect(container.querySelector("[data-push]")).toBeNull();
  });
});

describe("board-view › Hint", () => {
  const mine = { me: { cards: 12, target: TREASURES[0] } };
  const hintButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "Vihje" });

  it("Hint for the shift: previews the hinted shift, rings the square, sends nothing; another arrow drops the ring", () => {
    const { container, shift } = setup(mine);
    const turn = hintTurn(botViewOf(view(mine))!);
    fireEvent.click(hintButton());

    const entry = insertionLine(turn.insertion)[0]!;
    expect(tilePosition(container, board.spare.id)).toBe(at(entry.row, entry.col));
    expect(container.querySelector("[data-hint]")?.getAttribute("data-hint")).toBe(`${turn.to.row},${turn.to.col}`);
    expect(screen.getByRole("img", { name: `Vihje: kävele ruutuun rivi ${turn.to.row + 1}, sarake ${turn.to.col + 1}` })).toBeTruthy();
    expect(shift).not.toHaveBeenCalled();

    const other = [...container.querySelectorAll<HTMLElement>('[aria-label="Pelilauta"] [aria-pressed="false"]')].find((el) => el.getAttribute("aria-disabled") !== "true")!;
    fireEvent.click(other);
    expect(container.querySelector("[data-hint]")).toBeNull();
  });

  it("Not your turn: Vihje is shown disabled", () => {
    setup({ ...mine, turnSeat: 2 });
    expect(hintButton().disabled).toBe(true);
  });
});

describe("settings › confirmations in the game", () => {
  afterEach(() => {
    updateSettings(DEFAULT_SETTINGS);
  });

  it("One-tap shift: with confirm shift off an arrow sends the shift at once", async () => {
    updateSettings({ confirmShift: false });
    const { shift } = setup();
    await act(async () => {
      fireEvent.click(arrow("Työnnä ylhäältä sarakkeeseen 4"));
    });
    expect(shift).toHaveBeenCalledExactlyOnceWith("N3", board.spare.rotation);
  });

  it("Confirmed move: with confirm move on the first tap only chooses, the second moves", async () => {
    updateSettings({ confirmMove: true });
    const target = reachableSquares(board, square(0, 0)).at(-1)!;
    const { container, move } = setup({ phase: "move" });
    const cell = () => container.querySelector(`[data-move-target="${target.row},${target.col}"]`)!;
    fireEvent.click(cell());
    expect(move).not.toHaveBeenCalled();
    expect(cell().getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Kävele tänne" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Peru" }));
    expect(screen.queryByRole("button", { name: "Kävele tänne" })).toBeNull();

    fireEvent.click(cell());
    await act(async () => {
      fireEvent.click(cell());
    });
    expect(move).toHaveBeenCalledExactlyOnceWith(target);
  });
});

describe("settings › Settings on the device (in the game)", () => {
  it("Settings during a game: the gear opens the settings and Takaisin returns to the board", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
    expect(screen.queryByRole("region", { name: "Pelilauta" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Asetukset" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(screen.queryByRole("heading", { name: "Asetukset" })).toBeNull();
    expect(screen.getByRole("button", { name: "Asetukset" })).toBeTruthy();
  });
});
