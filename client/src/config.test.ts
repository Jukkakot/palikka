import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "./config.ts";

describe("resolveServerUrl", () => {
  it("falls back to the local server in development", () => {
    expect(resolveServerUrl({ PROD: false })).toBe("http://localhost:2567");
  });

  it("uses the configured URL without a trailing slash", () => {
    expect(resolveServerUrl({ PROD: true, VITE_SERVER_URL: " https://x.onrender.com/ " })).toBe(
      "https://x.onrender.com",
    );
  });

  it("fails in production when the URL is missing", () => {
    expect(() => resolveServerUrl({ PROD: true, VITE_SERVER_URL: "" })).toThrow(/VITE_SERVER_URL/);
  });
});
