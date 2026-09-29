// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.tsx";

describe("ui › Button", () => {
  it("is a real button that defaults to type=button and forwards clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Pelaa</Button>);
    const button = screen.getByRole("button", { name: "Pelaa" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Pelaa
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pelaa" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
