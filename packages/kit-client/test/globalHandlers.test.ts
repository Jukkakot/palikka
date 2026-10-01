// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { installGlobalErrorHandlers } from "../src/index.ts";

describe("observability › Client log shipping › uncaught client errors", () => {
  it("an uncaught ErrorEvent is logged as client.error with its stack", () => {
    const logger = { error: vi.fn() };
    const uninstall = installGlobalErrorHandlers(window, logger);

    const error = new Error("Cannot read x");
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message, filename: "Board.tsx", lineno: 17 }));
    uninstall();

    expect(logger.error).toHaveBeenCalledWith(
      "client.error",
      expect.objectContaining({ stack: error.stack, source: "Board.tsx", line: 17 }),
      "Cannot read x",
    );
  });

  it("an unhandled rejection is logged as client.error", () => {
    const logger = { error: vi.fn() };
    const uninstall = installGlobalErrorHandlers(window, logger);

    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: new Error("fetch failed") });
    window.dispatchEvent(event);
    uninstall();

    expect(logger.error).toHaveBeenCalledWith(
      "client.error",
      expect.objectContaining({ kind: "unhandledrejection" }),
      "fetch failed",
    );
  });
});
