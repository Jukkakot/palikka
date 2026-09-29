// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import type { Sharer } from "../ui/share.ts";
import { GameIdBadge } from "./GameIdBadge.tsx";

const tap = async (name: RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("board-view › Game link badge", () => {
  it("Share a running game: opens the share sheet with the watch text and the game link", async () => {
    const sharer: Sharer = { share: vi.fn(async () => {}), copy: vi.fn(async () => {}) };
    render(<GameIdBadge roomId="brave-otters-sing" sharer={sharer} />);
    expect(screen.getByRole("button", { name: /brave-otters-sing/ }).textContent).toBe("brave-otters-sing");

    await tap(/brave-otters-sing/);

    const data = vi.mocked(sharer.share!).mock.calls[0]![0];
    expect(data.text).toBe("Katso Labyrintti-peliäni");
    expect(data.url).toContain("game=brave-otters-sing");
    expect(sharer.copy).not.toHaveBeenCalled();
  });

  it("Share from the waiting room: the text asks to join", async () => {
    const sharer: Sharer = { share: vi.fn(async () => {}), copy: vi.fn(async () => {}) };
    render(<GameIdBadge roomId="brave-otters-sing" invite="join" sharer={sharer} />);
    await tap(/brave-otters-sing/);
    expect(vi.mocked(sharer.share!).mock.calls[0]![0].text).toBe("Liity Labyrintti-peliini");
  });

  it("No share sheet: copies the link and confirms", async () => {
    const sharer: Sharer = { copy: vi.fn(async () => {}) };
    render(<GameIdBadge roomId="brave-otters-sing" sharer={sharer} />);
    await tap(/brave-otters-sing/);
    expect(vi.mocked(sharer.copy).mock.calls[0]![0]).toContain("game=brave-otters-sing");
    expect(screen.getByRole("status").textContent).toBe("Linkki kopioitu");
  });

  it("Neither share nor copy works: the link is shown selectable", async () => {
    const sharer: Sharer = { copy: vi.fn(async () => Promise.reject(new Error("denied"))) };
    render(<GameIdBadge roomId="brave-otters-sing" sharer={sharer} />);
    await tap(/brave-otters-sing/);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toContain("game=brave-otters-sing");
    expect(input.readOnly).toBe(true);
  });

  it("Daily puzzle label: shows Päivän pulma and is not tappable", () => {
    render(<GameIdBadge roomId="local-daily-mujxitgji577" />);
    expect(screen.getByText("Päivän pulma")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Other game on the device: shows Oma peli", () => {
    render(<GameIdBadge roomId="local-abc123" />);
    expect(screen.getByText("Oma peli")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
