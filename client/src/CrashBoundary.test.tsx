// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./i18n";
import { CrashBoundary } from "./CrashBoundary.tsx";

function Broken(): never {
  throw new Error("render failed");
}

describe("observability › Crash screen", () => {
  it("Rendering error: calm Finnish message with reload, one client.error, no technical details", () => {
    const logger = { error: vi.fn() };
    // React reports caught render errors to console.error; keep test output clean.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <CrashBoundary logger={logger}>
        <Broken />
      </CrashBoundary>,
    );
    consoleError.mockRestore();

    expect(screen.getByRole("heading", { name: "Jokin jäätyi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lataa uudelleen" })).toBeTruthy();
    expect(screen.queryByText(/render failed/)).toBeNull();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "client.error",
      expect.objectContaining({ stack: expect.stringContaining("render failed"), kind: "render" }),
      "render failed",
    );
  });
});
