import { useEffect, useSyncExternalStore } from "react";
import { serverUrl } from "../config.ts";
import { log } from "../logging/logger.ts";
import { SLOW_CONNECT_MS } from "./useGameSession.ts";

/** One attempt may hang while Render spins up; give up on it after this long. */
export const WAKE_ATTEMPT_TIMEOUT_MS = 20_000;
/** Pause between failed attempts. */
export const WAKE_RETRY_MS = 2_000;
/** After this long without an answer the wake-up gives up and Play is enabled anyway. */
export const WAKE_DEADLINE_MS = 90_000;

export type WakeState = "waking" | "ready" | "failed";

export interface ServerWake {
  state: WakeState;
  /** True once waking has taken longer than SLOW_CONNECT_MS. */
  slow: boolean;
  /** Set when ready. `builtAt`: UTC ISO time, `null` for a server without a build, absent when unknown. */
  server?: { builtAt?: string | null };
}

export interface WakeDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  serverUrl: () => string;
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  log: Pick<typeof log, "info" | "warn">;
}

const defaultDeps = (): WakeDeps => ({
  fetch: (url, init) => fetch(url, init),
  serverUrl,
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  log,
});

/** Reads `builtAt` loosely: an older server or an odd body still counts as awake. */
async function readBuiltAt(res: Response): Promise<string | null | undefined> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "builtAt" in body) {
      const { builtAt } = body;
      if (typeof builtAt === "string" || builtAt === null) return builtAt;
    }
  } catch {
    // Not JSON: awake all the same.
  }
  return undefined;
}

/**
 * Wakes a sleeping server once per page load by fetching `/health`, which also
 * reports the server's build time. Retries until the server answers or the
 * deadline passes; never contacts the server again afterwards.
 */
export function createServerWake(overrides: Partial<WakeDeps> = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  let snapshot: ServerWake = { state: "waking", slow: false };
  const listeners = new Set<() => void>();
  let started: Promise<ServerWake> | undefined;

  const set = (next: Partial<ServerWake>) => {
    snapshot = { ...snapshot, ...next };
    for (const l of listeners) l();
  };

  function run(): Promise<ServerWake> {
    const t0 = deps.now();
    let attempts = 0;
    let url: string;
    try {
      url = `${deps.serverUrl()}/health`;
    } catch {
      deps.log.warn("client.warn", { kind: "wake", attempts }, "no server URL");
      set({ state: "failed" });
      return Promise.resolve(snapshot);
    }

    return new Promise<ServerWake>((resolve) => {
      let done = false;
      let current: AbortController | undefined;
      let wakeRetry: (() => void) | undefined;

      const finish = (next: Partial<ServerWake>) => {
        done = true;
        deps.clearTimeout(slowTimer);
        deps.clearTimeout(deadline);
        set(next);
        resolve(snapshot);
      };
      const slowTimer = deps.setTimeout(() => {
        if (!done) set({ slow: true });
      }, SLOW_CONNECT_MS);
      const deadline = deps.setTimeout(() => {
        if (done) return;
        deps.log.warn("client.warn", { kind: "wake", attempts }, "server did not answer");
        finish({ state: "failed" });
        current?.abort();
        wakeRetry?.();
      }, WAKE_DEADLINE_MS);

      void (async () => {
        while (!done) {
          attempts++;
          const controller = (current = new AbortController());
          const timeout = deps.setTimeout(() => controller.abort(), WAKE_ATTEMPT_TIMEOUT_MS);
          try {
            const res = await deps.fetch(url, { cache: "no-store", signal: controller.signal });
            if (res.ok) {
              const builtAt = await readBuiltAt(res);
              deps.clearTimeout(timeout);
              if (done) return;
              deps.log.info(
                "client.info",
                { kind: "wake", durMs: deps.now() - t0, attempts, serverBuiltAt: builtAt ?? null },
                "server awake",
              );
              finish({ state: "ready", server: builtAt === undefined ? {} : { builtAt } });
              return;
            }
          } catch {
            // Network error or timeout: retry below.
          }
          deps.clearTimeout(timeout);
          if (done) return;
          await new Promise<void>((next) => {
            wakeRetry = next;
            deps.setTimeout(next, WAKE_RETRY_MS);
          });
          wakeRetry = undefined;
        }
      })();
    });
  }

  return {
    /** Starts the wake-up on the first call; later calls return the same promise. */
    start: (): Promise<ServerWake> => (started ??= run()),
    get: (): ServerWake => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ServerWaker = ReturnType<typeof createServerWake>;

/** The page's one wake-up. */
export const serverWake = createServerWake();

export function startServerWake(): Promise<ServerWake> {
  return serverWake.start();
}

/** Starts the wake-up (once per page load) and follows its state. */
export function useServerWake(waker: ServerWaker = serverWake): ServerWake {
  useEffect(() => void waker.start(), [waker]);
  return useSyncExternalStore(waker.subscribe, waker.get);
}
