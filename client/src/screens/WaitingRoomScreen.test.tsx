// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import type { GameSession } from "../session/useGameSession.ts";
import type { SeatView } from "../session/viewModel.ts";
import type { Sharer } from "../ui/share.ts";
import { WaitingRoomScreen, type WaitingRoomScreenProps } from "./WaitingRoomScreen.tsx";
import { seatView } from "../test/views.ts";

const seat = (n: number, name: string, extra: Partial<SeatView> = {}): SeatView => seatView(n, name, { isMe: false, ...extra });

function setup(seats: SeatView[], mySeat: number, session: Partial<GameSession> = {}, sharer?: Sharer, variant: WaitingRoomScreenProps["view"]["variant"] = "classic") {
  const start = vi.fn<GameSession["start"]>(async () => ({ ok: true }));
  const leave = vi.fn<GameSession["leave"]>();
  const addBot = vi.fn<GameSession["addBot"]>(async () => ({ ok: true }));
  const removeBot = vi.fn<GameSession["removeBot"]>(async () => ({ ok: true }));
  const setVariant = vi.fn<GameSession["setVariant"]>(async () => ({ ok: true }));
  const view: WaitingRoomScreenProps["view"] = {
    roomId: "brave-otters-sing",
    variant,
    maxSeats: { classic: 4, duo: 2, double: 2, trio: 3 }[variant!],
    hostSeat: 1,
    mySeat,
    seats: seats.map((s) => ({ ...s, isMe: s.seat === mySeat })),
  };
  const copy = vi.fn(async (_text: string) => {});
  const utils = render(
    <WaitingRoomScreen view={view} session={{ start, addBot, removeBot, setVariant, leave, pending: false, ...session }} sharer={sharer ?? { copy }} />,
  );
  return { start, addBot, removeBot, setVariant, leave, copy, ...utils };
}

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("lobby › Waiting room", () => {
  it("Host alone: themselves as host, Kutsu pelaajia, and Aloita peli disabled with the two-player hint", () => {
    const { container } = setup([seat(1, "Maija")], 1);
    const row = container.querySelector("[data-seat='1']")!;
    expect(row.textContent).toContain("Maija");
    expect(row.textContent).toContain("sinä");
    expect(row.textContent).toContain("isäntä");
    expect(container.querySelectorAll("[data-free]")).toHaveLength(3);
    expect(screen.getAllByText("Vapaa paikka")).toHaveLength(3);
    expect(button("Kutsu pelaajia")).toBeTruthy();
    expect(button("Aloita peli").disabled).toBe(true);
    expect(screen.getByText("Tarvitaan vähintään 2 pelaajaa")).toBeTruthy();
  });

  it("Second player arrives: two players listed and Aloita peli enabled; tapping it starts", () => {
    const { start } = setup([seat(1, "Maija"), seat(2, "Pekka")], 1);
    expect(button("Aloita peli").disabled).toBe(false);
    expect(screen.queryByText("Tarvitaan vähintään 2 pelaajaa")).toBeNull();
    fireEvent.click(button("Aloita peli"));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("the start waits for the server", () => {
    setup([seat(1, "Maija"), seat(2, "Pekka")], 1, { pending: true });
    expect(button("Odotetaan palvelinta…").disabled).toBe(true);
  });

  it("Guest view: who is seated and whom they wait for, and no start action", () => {
    const { container } = setup([seat(1, "Maija"), seat(2, "Pekka")], 2);
    expect(screen.getByText("Odotetaan, että Maija aloittaa pelin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aloita peli" })).toBeNull();
    expect(container.querySelector("[data-seat='2']")!.textContent).toContain("sinä");
  });

  it("Solo game with a bot: the host adds and removes bots; bots are marked; Aloita peli enabled", () => {
    const { container, addBot, removeBot } = setup([seat(1, "Maija"), seat(3, "Robo", { isBot: true })], 1);
    expect(screen.getAllByRole("button", { name: /^Lisää botti paikalle/ })).toHaveLength(2);
    fireEvent.click(button("Lisää botti paikalle 2"));
    expect(addBot).toHaveBeenCalledWith(2);
    expect(container.querySelector("[data-seat='3']")!.textContent).toContain("botti");
    fireEvent.click(button("Poista botti Robo"));
    expect(removeBot).toHaveBeenCalledWith(3);
    expect(button("Aloita peli").disabled).toBe(false);
  });

  it("Guest view with a bot: the bot is marked, and no bot actions", () => {
    const { container } = setup([seat(1, "Maija"), seat(2, "Pekka"), seat(3, "Robo", { isBot: true })], 2);
    expect(container.querySelector("[data-seat='3']")!.textContent).toContain("botti");
    expect(screen.queryByRole("button", { name: /botti/i })).toBeNull();
  });

  it("a dropped player is shown as disconnected", () => {
    const { container } = setup([seat(1, "Maija"), seat(2, "Pekka", { connected: false })], 1);
    expect(container.querySelector("[data-seat='2']")!.textContent).toContain("yhteys katkennut");
  });

  it("Share the invite link: the share sheet gets the game's invite link", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    const copy = vi.fn(async () => {});
    setup([seat(1, "Maija")], 1, {}, { share, copy });
    await act(async () => fireEvent.click(button("Kutsu pelaajia")));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]![0].url).toMatch(/\?game=brave-otters-sing$/);
    expect(copy).not.toHaveBeenCalled();
  });

  it("without a share sheet the link is copied and the screen says so", async () => {
    const { copy } = setup([seat(1, "Maija")], 1);
    await act(async () => fireEvent.click(button("Kutsu pelaajia")));
    expect(copy.mock.calls[0]![0]).toMatch(/\?game=brave-otters-sing$/);
    expect(screen.getByText("Linkki kopioitu")).toBeTruthy();
  });

  it("an aborted share does nothing more", async () => {
    const share = vi.fn(async () => Promise.reject(Object.assign(new Error("abort"), { name: "AbortError" })));
    const copy = vi.fn(async () => {});
    setup([seat(1, "Maija")], 1, {}, { share, copy });
    await act(async () => fireEvent.click(button("Kutsu pelaajia")));
    expect(copy).not.toHaveBeenCalled();
    expect(screen.queryByText("Linkki kopioitu")).toBeNull();
  });

  it("a rejected start shows its message", () => {
    setup([seat(1, "Maija")], 1, { notice: "errors.NOT_ENOUGH_PLAYERS" });
    expect(screen.getByText("Pelaajia ei ole vielä tarpeeksi")).toBeTruthy();
  });
});

describe("lobby › Leaving the waiting room", () => {
  it("Guest leaves: at once, without a confirmation", () => {
    const { leave } = setup([seat(1, "Maija"), seat(2, "Pekka")], 2);
    fireEvent.click(button("Poistu"));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Host alone leaves without a confirmation", () => {
    const { leave } = setup([seat(1, "Maija")], 1);
    fireEvent.click(button("Poistu"));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("Host leaves: with others seated the host confirms first; Peru keeps the room", () => {
    const { leave } = setup([seat(1, "Maija"), seat(2, "Pekka"), seat(3, "Liisa")], 1);
    fireEvent.click(button("Poistu"));
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByText("Peli suljetaan kaikilta. Poistutaanko?")).toBeTruthy();
    fireEvent.click(button("Peru"));
    expect(button("Aloita peli")).toBeTruthy();

    fireEvent.click(button("Poistu"));
    fireEvent.click(button("Poistu"));
    expect(leave).toHaveBeenCalledTimes(1);
  });
});


describe("game-room › Choosing the variant (waiting room)", () => {
  it("Host picks a variant: four chips, Perus chosen, tapping Duo asks for it", () => {
    const { setVariant } = setup([seat(1, "Maija")], 1);
    const chips = screen.getAllByRole("radio");
    expect(chips.map((c) => c.textContent)).toEqual(["Perus", "Duo", "Tuplaväri", "Kolmikko"]);
    expect(screen.getByRole("radio", { name: "Perus" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("2–4 pelaajaa, jokaisella oma väri")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Duo" }));
    expect(setVariant).toHaveBeenCalledExactlyOnceWith("duo");
  });

  it("Duo shows two seats; a guest sees the variant without the picker", () => {
    const { container } = setup([seat(1, "Maija"), seat(2, "Pekka")], 2, {}, undefined, "duo");
    expect(container.querySelectorAll("ul[aria-label='Pelaajat'] > li")).toHaveLength(2);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("Pelimuoto: Duo")).toBeTruthy();
  });

  it("Tuplaväri: each seat shows its two colours; Kolmikko needs three to start", () => {
    const { container, unmount } = setup([seat(1, "Maija")], 1, {}, undefined, "double");
    expect([...container.querySelectorAll("[data-seat='1'] [data-seat]")].map((m) => m.getAttribute("data-seat"))).toEqual(["1", "3"]);
    unmount();
    setup([seat(1, "Maija"), seat(2, "Kettu", { isBot: true })], 1, {}, undefined, "trio");
    expect(button("Aloita peli").disabled).toBe(true);
    expect(screen.getByText("Tarvitaan 3 pelaajaa")).toBeTruthy();
  });

  it("TOO_MANY_PLAYERS is explained", () => {
    setup([seat(1, "Maija")], 1, { notice: "errors.TOO_MANY_PLAYERS" });
    expect(screen.getByText("Tähän pelimuotoon eivät mahdu kaikki pelaajat")).toBeTruthy();
  });
});
