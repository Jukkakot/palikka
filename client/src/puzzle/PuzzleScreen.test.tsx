// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { StartScreen, type StartScreenProps } from "../screens/StartScreen.tsx";
import PuzzleScreen from "./PuzzleScreen.tsx";
import { localDate, recordSolve, loadPuzzleSave, savePuzzle } from "./puzzleStore.ts";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const session = { status: "idle", slow: false } as unknown as StartScreenProps["session"];

describe("start-screen › Daily puzzle entry", () => {
  it("Open the puzzle: works while the server is still waking up", async () => {
    render(<StartScreen session={session} wake={{ state: "waking", slow: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaa pulma" }));
    expect((await screen.findByRole("list", { name: "Palikkasi" }, { timeout: 5000 })).children.length).toBeGreaterThanOrEqual(5);
  });

  it("Already solved: the entry shows the time and the streak", () => {
    savePuzzle(recordSolve(loadPuzzleSave(), localDate(), 7, 154_000));
    render(<StartScreen session={session} wake={{ state: "ready", slow: false, server: { builtAt: null } }} />);
    expect(screen.getByText("Ratkaistu ajassa 2:34 · putki 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Katso" })).toBeTruthy();
  });
});

describe("daily-puzzle › Solving, time and records", () => {
  it("Share: the text names the date, piece count, time and streak, and no positions", async () => {
    const date = "2026-10-01";
    savePuzzle(recordSolve(loadPuzzleSave(), date, 7, 154_000));
    const copy = vi.fn(async (_text: string) => {});
    render(<PuzzleScreen onClose={() => {}} options={{ date }} sharer={{ copy }} />);
    expect(screen.getByRole("heading", { name: "Kuvio kuurassa!" })).toBeTruthy();
    expect(screen.getByText("Uusi ennätys!")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aseta" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Jaa" }));
    await screen.findByText("Kopioitu leikepöydälle");
    const text = copy.mock.calls[0]![0];
    expect(text).toContain("Päivän pulma 1.10.2026 · 7 palaa · 2:34 · putki 1");
    expect(text).not.toMatch(/rivi|sarake|\d+,\d+/i);
  });
});
