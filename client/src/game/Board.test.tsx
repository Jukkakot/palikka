// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { setupBoard, TILE_SET, type TreasureId } from "@labyrinth/rules";
import { describe, expect, it } from "vitest";
import "../i18n";
import { Board } from "./Board.tsx";
import { collectedTreasures } from "./collected.ts";
import { SpareTile } from "./SpareTile.tsx";
import { TileView } from "./TileView.tsx";

const inSvg = (node: React.ReactNode) => render(<svg>{node}</svg>);

describe("board-view › Tiles show their corridors", () => {
  it("Corner tile: corridor arms toward exactly E and S", () => {
    const { container } = inSvg(<TileView tile={{ id: 30, kind: "corner", rotation: 90 }} />);
    const arms = [...container.querySelectorAll("[data-arm]")].map((el) => el.getAttribute("data-arm"));
    expect(arms).toEqual(["E", "S"]);
  });

  it("Fixed tiles recognisable: 16 tiles carry the fixed mark", () => {
    const { container } = render(<Board board={setupBoard(1)} />);
    expect(container.querySelectorAll("[data-tile-id]")).toHaveLength(49);
    expect(container.querySelectorAll("[data-fixed]")).toHaveLength(16);
  });
});

describe("board-view › Treasures shown as icons", () => {
  it("Treasure tile: dragon tile has an icon and a localized accessible name", () => {
    const dragon = TILE_SET.find((t) => t.treasure === "dragon")!;
    const { container } = inSvg(<TileView tile={{ id: dragon.id, kind: dragon.kind, rotation: 0 }} />);
    expect(screen.getByRole("img", { name: "Aarre: lohikäärme" })).toBeTruthy();
    expect(container.querySelector("svg svg")).not.toBeNull();
  });

  it("plain tiles are hidden from assistive technology", () => {
    const { container } = inSvg(<TileView tile={{ id: 16, kind: "straight", rotation: 0 }} />);
    expect(container.querySelector("g")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("board-view › Pawns on their squares", () => {
  it("Two players: circle top-left and square top-right, own pawn marked", () => {
    render(
      <Board
        board={setupBoard(1)}
        seats={[
          { seat: 1, sessionId: "a", name: "Maija", connected: true, isMe: true, isBot: false, cards: 0, found: [], square: { row: 0, col: 0 } },
          { seat: 2, sessionId: "b", name: "Pekka", connected: true, isMe: false, isBot: false, cards: 0, found: [], square: { row: 0, col: 6 } },
        ]}
      />,
    );
    const mine = screen.getByRole("img", { name: "Maija (sinä)" });
    const other = screen.getByRole("img", { name: "Pekka" });
    expect(mine.style.transform).toBe("translate(0px, 0px)");
    expect(other.style.transform).toBe("translate(600px, 0px)");
    expect(mine.querySelector("circle")).not.toBeNull(); // ownership ring
    expect(other.querySelector("circle")).toBeNull();
  });
});

describe("board-view › Pawns on their squares (shared)", () => {
  it("Shared square: both pawns visible, drawn smaller side by side", () => {
    render(
      <Board
        board={setupBoard(1)}
        seats={[
          { seat: 1, sessionId: "a", name: "Maija", connected: true, isMe: true, isBot: false, cards: 0, found: [], square: { row: 3, col: 2 } },
          { seat: 2, sessionId: "b", name: "Pekka", connected: true, isMe: false, isBot: false, cards: 0, found: [], square: { row: 3, col: 2 } },
          { seat: 3, sessionId: "c", name: "Liisa", connected: true, isMe: false, isBot: false, cards: 0, found: [], square: { row: 6, col: 6 } },
        ]}
      />,
    );
    const one = screen.getByRole("img", { name: "Maija (sinä)" });
    const two = screen.getByRole("img", { name: "Pekka" });
    expect(one.style.transform).toBe("translate(200px, 300px)");
    expect(two.style.transform).toBe("translate(200px, 300px)");
    expect(one.getAttribute("data-crowded")).toBe("true");
    expect(two.getAttribute("data-crowded")).toBe("true");
    expect(one.firstElementChild!.getAttribute("transform")).not.toBe(two.firstElementChild!.getAttribute("transform"));
    expect(screen.getByRole("img", { name: "Liisa" }).getAttribute("data-crowded")).toBeNull();
  });
});

describe("board-view › Spare tile shown", () => {
  it("Spare with treasure: drawn with corridors, icon and label", () => {
    const chestTile = TILE_SET.find((t) => t.treasure === "dragon")!;
    render(<SpareTile tile={{ id: chestTile.id, kind: chestTile.kind, rotation: 0 }} />);
    expect(screen.getByText("Ylimääräinen laatta")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Aarre: lohikäärme" })).toBeTruthy();
  });

  it("Spare with a collected treasure: corridors without the icon", () => {
    const dragon = TILE_SET.find((t) => t.treasure === "dragon")!;
    const { container } = render(
      <SpareTile tile={{ id: dragon.id, kind: dragon.kind, rotation: 0 }} collected={collectedTreasures([{ found: ["dragon"] }])} />,
    );
    expect(screen.queryByRole("img", { name: "Aarre: lohikäärme" })).toBeNull();
    expect(container.querySelectorAll("[data-arm]").length).toBeGreaterThan(0);
  });
});

describe("board-view › Treasures shown as icons (collected)", () => {
  const board = setupBoard(1);
  const withTreasure = board.squares.filter((tile) => TILE_SET[tile.id]?.treasure);
  const [first, second] = [withTreasure[0]!, withTreasure[1]!];
  const firstTreasure = TILE_SET[first.id]!.treasure!;
  const seat = (no: number, isMe: boolean, found: TreasureId[]) => ({
    seat: no, sessionId: `s${no}`, name: `P${no}`, connected: true, isMe, isBot: false, cards: 5, found, square: { row: 0, col: 0 },
  });
  const tileEl = (container: HTMLElement, id: number) => container.querySelector(`[data-tile-id="${id}"]`)!;

  it("Collected treasure hidden: another player's find is drawn as a plain tile", () => {
    const { container } = render(<Board board={board} seats={[seat(1, true, []), seat(2, false, [firstTreasure])]} />);
    expect(tileEl(container, first.id).getAttribute("aria-hidden")).toBe("true");
    expect(tileEl(container, first.id).querySelector("svg")).toBeNull();
    expect(tileEl(container, second.id).querySelector("svg")).not.toBeNull();
  });

  it("Own target always shown, even when its treasure is in a found list", () => {
    const { container } = render(
      <Board board={board} seats={[seat(1, true, [firstTreasure])]} target={{ tileId: first.id, home: false }} />,
    );
    const el = tileEl(container, first.id);
    expect(el.getAttribute("data-target")).toBe("treasure");
    expect(el.getAttribute("aria-label")).toBeTruthy();
    expect(el.querySelectorAll("svg")).toHaveLength(2); // treasure icon + target badge
  });
});
