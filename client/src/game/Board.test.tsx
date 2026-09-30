// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../i18n";
import { Board } from "./Board.tsx";

const board = Array<number>(16).fill(0).map((_, i) => (i < 2 ? 1 : i === 5 ? 2 : 0));
const cell = (container: HTMLElement, i: number) => container.querySelector(`[data-cell="${i}"]`)!;

describe("game-motion › Last move marked on the board", () => {
  it("the last move's filled squares carry data-last; others and empty squares do not", () => {
    const { container } = render(<Board board={board} lastMove={new Set([0, 1, 9])} fresh={new Set([0, 1])} />);
    expect(cell(container, 0).hasAttribute("data-last")).toBe(true);
    expect(cell(container, 1).hasAttribute("data-last")).toBe(true);
    expect(cell(container, 5).hasAttribute("data-last")).toBe(false);
    expect(cell(container, 9).hasAttribute("data-last")).toBe(false);
  });

  it("no mark without a last move", () => {
    const { container } = render(<Board board={board} />);
    expect(container.querySelector("[data-last]")).toBeNull();
  });
});
