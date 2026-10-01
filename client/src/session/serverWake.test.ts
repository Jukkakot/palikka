import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerWake, WAKE_DEADLINE_MS, type WakeDeps } from "@game-kit/client";
import { SLOW_CONNECT_MS } from "./useGameSession.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fetch that never answers, but rejects when aborted like the real one. */
const hanging: WakeDeps["fetch"] = (_url, init) =>
  new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));

function setup(fetch: WakeDeps["fetch"], extra: Partial<WakeDeps> = {}) {
  const spy = vi.fn(fetch);
  const log = { info: vi.fn(), warn: vi.fn() };
  const wake = createServerWake({ fetch: spy, serverUrl: () => "https://srv.test", log, ...extra });
  return { wake, fetch: spy, log };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("server wake-up", () => {
  it("is ready after one request to an awake server, with its build time", async () => {
    const { wake, fetch, log } = setup(async () => json({ status: "ok", builtAt: "2026-09-26T15:35:00.000Z" }));
    expect(wake.get().state).toBe("waking");

    await wake.start();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://srv.test/health");
    expect(wake.get()).toEqual({ state: "ready", slow: false, server: { builtAt: "2026-09-26T15:35:00.000Z" } });
    expect(log.info).toHaveBeenCalledWith(
      "client.info",
      expect.objectContaining({ kind: "wake", attempts: 1, serverBuiltAt: "2026-09-26T15:35:00.000Z" }),
      "server awake",
    );
  });

  it("retries after 503 and is ready after the second request", async () => {
    const { wake, fetch } = setup(vi.fn<WakeDeps["fetch"]>().mockResolvedValueOnce(json({}, 503)).mockResolvedValue(json({ builtAt: null })));

    const done = wake.start();
    await vi.advanceTimersByTimeAsync(2_000);
    await done;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(wake.get()).toMatchObject({ state: "ready", server: { builtAt: null } });
  });

  it("counts a body without builtAt as ready with an unknown build time", async () => {
    const { wake } = setup(async () => new Response("ok"));
    await wake.start();
    expect(wake.get()).toMatchObject({ state: "ready", server: {} });
    expect(wake.get().server).not.toHaveProperty("builtAt");
  });

  it("turns slow while waking, fails at the deadline and then stops asking", async () => {
    const { wake, fetch, log } = setup(hanging);
    const done = wake.start();

    await vi.advanceTimersByTimeAsync(SLOW_CONNECT_MS);
    expect(wake.get()).toMatchObject({ state: "waking", slow: true });

    await vi.advanceTimersByTimeAsync(WAKE_DEADLINE_MS - SLOW_CONNECT_MS - 1);
    expect(wake.get().state).toBe("waking");
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(wake.get().state).toBe("failed");
    expect(log.warn).toHaveBeenCalledWith("client.warn", expect.objectContaining({ kind: "wake" }), "server did not answer");

    const calls = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it("fails at the deadline even if a request ignores the abort", async () => {
    const { wake } = setup(() => new Promise<Response>(() => {}));
    const done = wake.start();
    await vi.advanceTimersByTimeAsync(WAKE_DEADLINE_MS);
    await done;
    expect(wake.get().state).toBe("failed");
  });

  it("reuses the first start", async () => {
    const { wake, fetch } = setup(async () => json({ builtAt: null }));
    const first = wake.start();
    expect(wake.start()).toBe(first);
    await first;
    await wake.start();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("fails at once without a server URL", async () => {
    const { wake, fetch } = setup(hanging, {
      serverUrl: () => {
        throw new Error("VITE_SERVER_URL is not set");
      },
    });
    await wake.start();
    expect(wake.get().state).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });
});
