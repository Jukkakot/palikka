// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import type { ServerWake } from "../session/serverWake.ts";
import { BuildInfo } from "./BuildInfo.tsx";
import { StartScreen, type StartScreenProps } from "./StartScreen.tsx";

const ready: ServerWake = { state: "ready", slow: false, server: { builtAt: null } };

/** A start-screen session: idle unless overridden, every action a spy. */
function sessionOf(overrides: Partial<StartScreenProps["session"]> = {}): StartScreenProps["session"] {
  return {
    status: "idle",
    slow: false,
    createGame: vi.fn(),
    joinById: vi.fn(),
    playBots: vi.fn(),
    joinInvite: vi.fn(),
    watch: vi.fn(),
    watchBots: vi.fn(),
    retry: vi.fn(),
    resume: vi.fn(),
    ...overrides,
  };
}

// A returning player: the remembered nickname makes the join actions available.
beforeEach(() => localStorage.setItem("palikka.nickname", "Maija"));
afterEach(() => localStorage.clear());

describe("game-session › Quick createGame (start screen)", () => {
  it("offers a single Play action", () => {
    const createGame = vi.fn();
    render(<StartScreen session={sessionOf({ status: "idle", slow: false, createGame })} wake={ready} />);
    fireEvent.click(screen.getByRole("button", { name: "Luo peli" }));
    expect(createGame).toHaveBeenCalledExactlyOnceWith("Maija");
    expect(screen.getByRole("heading", { name: "Pelaa botteja vastaan" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Luo peli kavereille" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pelaa" })).toBeNull();
  });

  it("Slow server: connecting state with the waking-up hint", () => {
    render(<StartScreen session={sessionOf({ status: "connecting", slow: true, createGame: vi.fn() })} wake={ready} />);
    expect(screen.getByRole("status").textContent).toContain("Yhdistetään palvelimeen");
    expect(screen.getByText(/saattaa olla heräämässä/)).toBeTruthy();
  });

  it("Join fails: calm message and retry, no technical details", () => {
    const retry = vi.fn();
    render(<StartScreen session={sessionOf({ status: "error", slow: false, retry })} wake={ready} />);
    expect(screen.getByRole("alert").textContent).toContain("Peliin ei päästy");
    fireEvent.click(screen.getByRole("button", { name: "Yritä uudelleen" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("game-session › Quick createGame (early wake-up)", () => {
  const idle = { status: "idle" as const, slow: false, createGame: vi.fn() };
  const playButton = () => screen.getByRole("button", { name: "Luo peli" }) as HTMLButtonElement;

  it("Sleeping server is woken on open: Play disabled and the screen says so", () => {
    render(<StartScreen session={sessionOf(idle)} wake={{ state: "waking", slow: false }} />);
    expect(playButton().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Herätetään palvelinta talviunilta…");
  });

  it("adds that waking can take about a minute once it is slow", () => {
    render(<StartScreen session={sessionOf(idle)} wake={{ state: "waking", slow: true }} />);
    expect(screen.getByRole("status").textContent).toContain("noin minuutin");
  });

  it("Server wakes up: the message goes away and Play can be tapped", () => {
    const createGame = vi.fn();
    const { rerender } = render(<StartScreen session={sessionOf({ ...idle, createGame })} wake={{ state: "waking", slow: true }} />);
    rerender(<StartScreen session={sessionOf({ ...idle, createGame })} wake={ready} />);
    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.click(playButton());
    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it("Server does not answer: Play enabled with a calm note", () => {
    const createGame = vi.fn();
    render(<StartScreen session={sessionOf({ ...idle, createGame })} wake={{ state: "failed", slow: true }} />);
    expect(screen.getByRole("status").textContent).toBe("Palvelin ei vastannut vielä – voit silti yrittää.");
    fireEvent.click(playButton());
    expect(createGame).toHaveBeenCalledTimes(1);
  });
});

describe("observability › Build times on the start screen", () => {
  // Expected text in the test's own time zone, formatted like the component.
  const local = (iso: string) => {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("fi", { day: "numeric", month: "numeric", year: "numeric" }).format(d);
    const time = new Intl.DateTimeFormat("fi", { hour: "2-digit", minute: "2-digit" }).format(d);
    return `${date} ${time}`;
  };

  it("Fresh deploy is visible: client and server build times in local time", () => {
    render(
      <BuildInfo
        clientBuilt="2026-09-26T15:40:00.000Z"
        wake={{ state: "ready", slow: false, server: { builtAt: "2026-09-26T15:35:00.000Z" } }}
      />,
    );
    expect(screen.getByText(`Client ${local("2026-09-26T15:40:00.000Z")}`)).toBeTruthy();
    expect(screen.getByText(`Server ${local("2026-09-26T15:35:00.000Z")}`)).toBeTruthy();
  });

  it("Server still waking: client time shown, server line says it is being woken", () => {
    render(<BuildInfo clientBuilt="2026-09-26T15:40:00.000Z" wake={{ state: "waking", slow: false }} />);
    expect(screen.getByText(/^Client \d/)).toBeTruthy();
    expect(screen.getByText("Server: herätetään…")).toBeTruthy();
  });

  it("Server does not answer: server line says so", () => {
    render(<BuildInfo clientBuilt={null} wake={{ state: "failed", slow: true }} />);
    expect(screen.getByText("Server: ei vastannut")).toBeTruthy();
  });

  it("Local development: dev instead of a time; an unknown server time is ?", () => {
    const { rerender } = render(<BuildInfo clientBuilt={null} wake={ready} />);
    expect(screen.getByText("Client dev")).toBeTruthy();
    expect(screen.getByText("Server dev")).toBeTruthy();
    rerender(<BuildInfo clientBuilt={null} wake={{ state: "ready", slow: false, server: {} }} />);
    expect(screen.getByText("Server ?")).toBeTruthy();
  });

  it("the start screen footer shows both lines", () => {
    render(<StartScreen session={sessionOf({ status: "idle", slow: false, createGame: vi.fn() })} wake={ready} />);
    expect(screen.getByText("Client dev")).toBeTruthy();
    expect(screen.getByText("Server dev")).toBeTruthy();
  });
});

describe("game-session › Kicked player informed", () => {
  it("Kicked: the start screen explains why, and Play is available", () => {
    const createGame = vi.fn();
    render(<StartScreen session={sessionOf({ status: "idle", slow: false, createGame, startNotice: "kicked" })} wake={ready} />);
    expect(screen.getByRole("status").textContent).toContain("Sinut poistettiin pelistä, koska vuorosi aika loppui.");
    fireEvent.click(screen.getByRole("button", { name: "Luo peli" }));
    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it("no message without a reason", () => {
    render(<StartScreen session={sessionOf({ status: "idle", slow: false, createGame: vi.fn() })} wake={ready} />);
    expect(screen.queryByText(/Sinut poistettiin/)).toBeNull();
  });
});

describe("lobby › Nickname", () => {
  const field = () => screen.getByRole("textbox", { name: "Nimimerkki" }) as HTMLInputElement;
  const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

  it("Remembered nickname: the field is prefilled", () => {
    render(<StartScreen session={sessionOf()} wake={ready} />);
    expect(field().value).toBe("Maija");
  });

  it("Valid nickname: trimmed, and the actions become available", () => {
    localStorage.clear();
    const createGame = vi.fn();
    render(<StartScreen session={sessionOf({ createGame })} wake={ready} />);
    fireEvent.change(field(), { target: { value: "" } });
    expect(button("Luo peli").disabled).toBe(true);
    fireEvent.change(field(), { target: { value: "  Pekka  " } });
    expect(button("Luo peli").disabled).toBe(false);
    fireEvent.click(button("Luo peli"));
    expect(createGame).toHaveBeenCalledExactlyOnceWith("Pekka");
  });

  it("Random name for a new player: a valid name is ready and Play works at once; the dice draws another", () => {
    localStorage.clear();
    const createGame = vi.fn();
    render(<StartScreen session={sessionOf({ createGame })} wake={ready} />);
    const first = field().value;
    expect(first).toMatch(/^\S+ \S+$/);
    expect(button("Luo peli").disabled).toBe(false);
    const random = vi.spyOn(Math, "random").mockReturnValue(first.startsWith("Rohkea") ? 0.5 : 0);
    fireEvent.click(button("Arvo uusi nimi"));
    random.mockRestore();
    expect(field().value).not.toBe(first);
    fireEvent.click(button("Luo peli"));
    expect(createGame).toHaveBeenCalledExactlyOnceWith(field().value);
  });

  it("Too short: every join and create action is disabled and a hint says 2–16 characters", () => {
    render(<StartScreen session={sessionOf()} wake={ready} openGames={{ status: "ready", games: [{ roomId: "a-b-c", host: "Liisa", seated: 1, variant: "classic", maxSeats: 4 }], running: [] }} />);
    fireEvent.change(field(), { target: { value: "M" } });
    expect(button("Luo peli").disabled).toBe(true);
    expect(button("Liity peliin: Liisa, Perus, 1/4 pelaajaa").disabled).toBe(true);
    expect(screen.getByText("Nimimerkissä pitää olla 2–16 merkkiä")).toBeTruthy();
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("Quick game against bots: 1v1–1v3 disabled like Play, and tapping 1v2 starts a game against two bots", () => {
    const session = sessionOf();
    render(<StartScreen session={session} wake={ready} />);
    fireEvent.change(field(), { target: { value: "M" } });
    for (const n of [1, 2, 3]) expect(screen.getByRole("button", { name: new RegExp(`sinä ja ${n} bott`) }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(field(), { target: { value: "Maija" } });
    fireEvent.click(button("Pikapeli: sinä ja 2 bottia"));
    expect(session.playBots).toHaveBeenCalledWith("Maija", 2, "classic");
  });

  it("start-screen › Duo against a bot: no bot count, starting opens a Duo game against one bot", () => {
    const session = sessionOf();
    render(<StartScreen session={session} wake={ready} />);
    expect(screen.getByRole("radio", { name: "Perus" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Duo" }));
    expect(screen.queryByRole("button", { name: /sinä ja 2 bott/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /sinä ja 3 bott/ })).toBeNull();
    fireEvent.change(field(), { target: { value: "Maija" } });
    fireEvent.click(button("Pikapeli: sinä ja 1 botti"));
    expect(session.playBots).toHaveBeenCalledExactlyOnceWith("Maija", 1, "duo");
  });

  it("start-screen › Kolmikko against two bots, and watching Tuplaväri takes two bots", () => {
    const session = sessionOf();
    render(<StartScreen session={session} wake={ready} />);
    fireEvent.click(screen.getByRole("radio", { name: "Kolmikko" }));
    fireEvent.change(field(), { target: { value: "Maija" } });
    fireEvent.click(button("Pikapeli: sinä ja 2 bottia"));
    expect(session.playBots).toHaveBeenCalledExactlyOnceWith("Maija", 2, "trio");
    fireEvent.click(screen.getByRole("radio", { name: "Tuplaväri" }));
    fireEvent.click(screen.getByRole("switch", { name: "Pelaan itse" }));
    fireEvent.click(button("Katso 2 botin peliä"));
    expect(session.watchBots).toHaveBeenCalledExactlyOnceWith("Maija", 2, 1, "double");
  });

  it("No waiting for the server: 1v1–1v3 and a device game's Jatka peliä stay enabled while waking", () => {
    const resumable = { token: "local:local-abc", roomId: "local-abc", seenAt: 0 };
    render(<StartScreen session={sessionOf({ resumable })} wake={{ state: "waking", slow: false }} />);
    for (const n of [1, 2, 3]) expect(screen.getByRole("button", { name: new RegExp(`sinä ja ${n} bott`) }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Jatka peliä" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Luo peli" }).hasAttribute("disabled")).toBe(true);
  });

  it("control characters get their own hint", () => {
    render(<StartScreen session={sessionOf()} wake={ready} />);
    fireEvent.change(field(), { target: { value: "Ma\u0007ija" } });
    expect(screen.getByText("Nimimerkissä on merkkejä, joita ei voi käyttää")).toBeTruthy();
  });
});

describe("lobby › Open games list and private game", () => {
  const games = { status: "ready" as const, games: [{ roomId: "brave-otters-sing", host: "Liisa", seated: 2, variant: "classic" as const, maxSeats: 4 }], running: [] };

  it("start-screen › A waiting game: listed under Liity peliin; an entry shows the host and seats, and tapping it joins that game", () => {
    const joinById = vi.fn();
    render(<StartScreen session={sessionOf({ joinById })} wake={ready} openGames={games} />);
    const entry = screen.getByRole("button", { name: "Liity peliin: Liisa, Perus, 2/4 pelaajaa" });
    expect(entry.textContent).toBe("Liisa· Perus · 2/4");
    fireEvent.click(entry);
    expect(joinById).toHaveBeenCalledExactlyOnceWith("brave-otters-sing", "Maija");
  });

  it("start-screen › A waiting Duo game shows its variant and seats of two", () => {
    const duo = { status: "ready" as const, games: [{ roomId: "a-b-c", host: "Liisa", seated: 1, variant: "duo" as const, maxSeats: 2 }], running: [] };
    render(<StartScreen session={sessionOf()} wake={ready} openGames={duo} />);
    expect(screen.getByRole("button", { name: "Liity peliin: Liisa, Duo, 1/2 pelaajaa" }).textContent).toBe("Liisa· Duo · 1/2");
  });

  it("start-screen › Nothing to show: no games section when both lists are empty", () => {
    render(<StartScreen session={sessionOf()} wake={ready} openGames={{ status: "ready", games: [], running: [] }} />);
    expect(screen.queryByRole("heading", { name: "Liity peliin" })).toBeNull();
  });

  it("the list could not be loaded: no games section, Luo peli still works", () => {
    render(<StartScreen session={sessionOf()} wake={ready} openGames={{ status: "failed", games: [], running: [] }} />);
    expect(screen.queryByRole("heading", { name: "Liity peliin" })).toBeNull();
    expect((screen.getByRole("button", { name: "Luo peli" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Create a private game: there is no such action any more", () => {
    render(<StartScreen session={sessionOf()} wake={ready} />);
    expect(screen.queryByRole("button", { name: "Luo yksityinen peli" })).toBeNull();
  });

  it.each([
    ["notOpen", "Peli ei ole enää avoinna"],
    ["hostLeft", "Pelin luoja poistui, joten peli suljettiin"],
    ["serverFull", "Palvelin on täynnä – yritä hetken päästä uudelleen"],
  ] as const)("start notice %s is shown in the status line", (startNotice, text) => {
    render(<StartScreen session={sessionOf({ startNotice })} wake={ready} />);
    expect(screen.getByRole("status").textContent).toBe(text);
  });
});

describe("spectators › start screen", () => {
  it("Watch from the list: a running game shows host and players, and tapping it watches that game", () => {
    const watch = vi.fn();
    const openGames = { status: "ready" as const, games: [], running: [{ roomId: "calm-foxes-jump", host: "Maija", seated: 3, variant: "classic" as const, maxSeats: 4 }] };
    render(<StartScreen session={sessionOf({ watch })} wake={ready} openGames={openGames} />);
    expect(screen.getByText("Käynnissä olevat pelit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Katso peliä: Maija, Perus, 3 pelaajaa" }));
    expect(watch).toHaveBeenCalledExactlyOnceWith("calm-foxes-jump", "Maija");
  });

  it("no running games: no section", () => {
    render(<StartScreen session={sessionOf()} wake={ready} openGames={{ status: "ready", games: [], running: [] }} />);
    expect(screen.queryByText("Käynnissä olevat pelit")).toBeNull();
  });

  it("Watch three bots: Pelaan itse off offers 2–4 bots, 3 bottia starts watching; enabled while waking", () => {
    const watchBots = vi.fn();
    render(<StartScreen session={sessionOf({ watchBots })} wake={{ state: "waking", slow: false }} />);
    const myself = screen.getByRole<HTMLInputElement>("switch", { name: "Pelaan itse" });
    expect(myself.checked).toBe(true);
    expect(screen.queryByRole("button", { name: "Katso 3 botin peliä" })).toBeNull();
    fireEvent.click(myself);
    expect(screen.queryByRole("button", { name: "Pikapeli: sinä ja 1 botti" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Katso \d botin peliä$/ }).map((b) => b.textContent)).toEqual(["2 bottia", "3 bottia", "4 bottia"]);
    fireEvent.click(screen.getByRole("button", { name: "Katso 3 botin peliä" }));
    expect(watchBots).toHaveBeenCalledExactlyOnceWith("Maija", 3, 1, "classic");
  });
});

describe("lobby › Invite mode", () => {
  it("Join by invite link: the invite message, Liity peliin joins that game (or watches it), and the invite is done", () => {
    const joinInvite = vi.fn();
    const onInviteDone = vi.fn();
    render(<StartScreen session={sessionOf({ joinInvite })} wake={ready} invite="calm-foxes-jump" onInviteDone={onInviteDone} />);
    expect(screen.getByText("Sinut on kutsuttu peliin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Luo peli" })).toBeNull();
    expect(screen.queryByText("Avoimet pelit")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Liity peliin" }));
    expect(joinInvite).toHaveBeenCalledExactlyOnceWith("calm-foxes-jump", "Maija");
    expect(onInviteDone).toHaveBeenCalledTimes(1);
  });

  it("Muut pelit leaves invite mode without joining", () => {
    const joinById = vi.fn();
    const onInviteDone = vi.fn();
    render(<StartScreen session={sessionOf({ joinById })} wake={ready} invite="calm-foxes-jump" onInviteDone={onInviteDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Muut pelit" }));
    expect(onInviteDone).toHaveBeenCalledTimes(1);
    expect(joinById).not.toHaveBeenCalled();
  });
});

describe("game-session › Server wake-up progress", () => {
  afterEach(() => vi.useRealTimers());

  it("Waiting counts up: the time waited as m:ss, gone once the server answers", () => {
    vi.useFakeTimers();
    const { rerender } = render(<StartScreen session={sessionOf()} wake={{ state: "waking", slow: false }} />);
    expect(screen.getByRole("status").textContent).toContain("0:00");
    act(() => vi.advanceTimersByTime(23_000));
    expect(screen.getByRole("status").textContent).toContain("Odotettu 0:23");
    rerender(<StartScreen session={sessionOf()} wake={ready} />);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("game-session › Resume after closing the app (start screen)", () => {
  const resumable = { token: "t", roomId: "brave-otters-sing", seenAt: 0 };

  it("App reopened mid-game: Jatka peliä is the primary action and resumes; disabled while waking", () => {
    const resume = vi.fn();
    const { rerender } = render(<StartScreen session={sessionOf({ resumable, resume })} wake={{ state: "waking", slow: false }} />);
    const button = () => screen.getByRole("button", { name: "Jatka peliä" }) as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    rerender(<StartScreen session={sessionOf({ resumable, resume })} wake={ready} />);
    expect(button().className).toMatch(/primary/);
    expect(screen.getByRole("button", { name: "Luo peli" }).className).toMatch(/secondary/);
    fireEvent.click(button());
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("no offer without a remembered game or in invite mode; the gone notice is shown", () => {
    render(<StartScreen session={sessionOf({ startNotice: "resumeGone" })} wake={ready} />);
    expect(screen.queryByRole("button", { name: "Jatka peliä" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Peliä ei voi enää jatkaa");
    cleanup();
    render(<StartScreen session={sessionOf({ resumable })} wake={ready} invite="brave-otters-sing" />);
    expect(screen.queryByRole("button", { name: "Jatka peliä" })).toBeNull();
  });
});

describe("how-to-createGame › Rules screen reachable before and during a game", () => {
  it("From the start screen: Näin pelaat opens the rules, Takaisin returns", () => {
    render(<StartScreen session={sessionOf()} wake={ready} />);
    fireEvent.click(screen.getByRole("button", { name: "Näin pelaat" }));
    expect(screen.getByRole("heading", { level: 1, name: "Näin pelaat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Takaisin" }));
    expect(screen.getByRole("heading", { level: 1, name: "Palikka" })).toBeTruthy();
  });
});
