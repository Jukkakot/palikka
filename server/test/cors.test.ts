import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { isOriginAllowed, parseAllowedOrigins } from "../src/cors.js";

describe("CORS", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  beforeAll(async () => {
    process.env.ALLOWED_ORIGINS = "https://jukkakot.github.io";
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    delete process.env.ALLOWED_ORIGINS;
  });

  async function allowOriginHeader(origin: string) {
    const res = await colyseus.http.get("/health", { headers: { Origin: origin } });
    return res.headers["access-control-allow-origin"] ?? null;
  }

  it("allows a listed origin", async () => {
    expect(await allowOriginHeader("https://jukkakot.github.io")).toBe("https://jukkakot.github.io");
  });

  it("does not allow an unlisted origin", async () => {
    expect(await allowOriginHeader("https://evil.example")).toBeNull();
  });

  it("allows LAN dev origins only outside production", () => {
    expect(isOriginAllowed("http://192.168.1.20:5173", [], false)).toBe(true);
    expect(isOriginAllowed("http://192.168.1.20:5173", [], true)).toBe(false);
  });

  it("parses a comma-separated list", () => {
    expect(parseAllowedOrigins(" https://a.example, ,https://b.example ")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
