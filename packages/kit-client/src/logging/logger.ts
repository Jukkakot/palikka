// The client compiles the kit from source, so the ambient declaration must come along with this file.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./pino-browser.d.ts" />
// The browser build explicitly (it has `transmit`), also under Vitest.
import pino from "pino/browser.js";
import { CLIENT_LOG_LIMITS, type ClientLogEntry, type KitClientLogEvent, type LogLevel } from "@game-kit/protocol";
import { kitConfig } from "../config.ts";
import { LogShipper, type SendFn } from "./shipper.ts";

export type LogFields = Record<string, unknown> & { stack?: string };

/**
 * A game's own client log events, added by declaration merging:
 * `declare module "@game-kit/client" { interface GameClientLogEvents { "client.puzzle.solved": true } }`.
 */
// oxlint-disable-next-line typescript/no-empty-interface
export interface GameClientLogEvents {}

/** Every client log event name: the kit's and the game's. */
export type ClientLogEvent = KitClientLogEvent | (keyof GameClientLogEvents & string);

const FLUSH_INTERVAL_MS = 5_000;
const L = CLIENT_LOG_LIMITS;

/** This client's build version (the game configures it). */
export const clientVersion = (): string => kitConfig().clientVersion();

/** `?debug=1` ships every level from this client. */
export const isDebugMode = (search = globalThis.location?.search ?? ""): boolean =>
  new URLSearchParams(search).get("debug") === "1";

/** warn/error always, key events always, everything else only in debug mode. */
export function shouldShip(level: LogLevel, evt: ClientLogEvent, debug: boolean): boolean {
  return debug || level === "warn" || level === "error" || kitConfig().keyEvents.includes(evt);
}

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** Keeps only primitive fields, within the server's limits. */
function toFields(fields: Record<string, unknown>): ClientLogEntry["fields"] {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields).slice(0, L.maxFields)) {
    const k = truncate(key, L.maxId);
    if (value === null || typeof value === "number" || typeof value === "boolean") out[k] = value;
    else if (typeof value === "string") out[k] = truncate(value, L.maxFieldValue);
    else if (value !== undefined) out[k] = truncate(JSON.stringify(value) ?? String(value), L.maxFieldValue);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Room and player of the current game, added to every entry. */
let context: { room?: string; player?: string } = {};
export function setLogContext(next: { room?: string; player?: string }): void {
  context = next;
}

export function toEntry(level: LogLevel, evt: ClientLogEvent, fields: LogFields, msg: string | undefined, ts: number) {
  const { stack, ...rest } = fields;
  const entry: ClientLogEntry = { level, evt, ts: new Date(ts).toISOString(), ...context };
  if (msg) entry.msg = truncate(msg, L.maxMsg);
  if (typeof stack === "string") entry.stack = truncate(stack, L.maxStack);
  const f = toFields(rest);
  if (f) entry.fields = f;
  return entry;
}

const sendToServer: SendFn = async (body, keepalive) => {
  const res = await fetch(`${kitConfig().serverUrl()}/client-logs`, {
    method: "POST",
    // text/plain keeps this a "simple" CORS request: no preflight.
    headers: { "Content-Type": "text/plain" },
    body,
    keepalive,
  });
  return res.ok;
};

export function createClientLogger({ send = sendToServer, debug = isDebugMode() }: { send?: SendFn; debug?: boolean } = {}) {
  const shipper = new LogShipper(send, clientVersion);

  const base = pino({
    level: debug ? "debug" : "info",
    browser: {
      transmit: {
        send: (level, logEvent) => {
          const [obj, msg] = logEvent.messages as [{ evt: ClientLogEvent } & LogFields, string | undefined];
          const lvl = level as LogLevel;
          if (!shouldShip(lvl, obj.evt, debug)) return;
          const { evt, ...fields } = obj;
          shipper.add(toEntry(lvl, evt, fields, msg, logEvent.ts));
          if (lvl === "error") void shipper.flush();
        },
      },
    },
  });

  const at =
    (level: LogLevel) =>
    (evt: ClientLogEvent, fields: LogFields = {}, msg?: string): void => {
      if (msg === undefined) base[level]({ evt, ...fields });
      else base[level]({ evt, ...fields }, msg);
    };

  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
    shipper,
    flush: (keepalive = false) => shipper.flush({ keepalive }),
  };
}

export const log = createClientLogger();

/** Periodic flushing plus a final keepalive flush when the page is hidden or closed. */
export function startLogShipping(target: Window = window): () => void {
  const timer = target.setInterval(() => void log.flush(), FLUSH_INTERVAL_MS);
  const onHide = () => void log.flush(true);
  const onVisibility = () => {
    if (target.document.visibilityState === "hidden") onHide();
  };
  target.document.addEventListener("visibilitychange", onVisibility);
  target.addEventListener("pagehide", onHide);
  return () => {
    target.clearInterval(timer);
    target.document.removeEventListener("visibilitychange", onVisibility);
    target.removeEventListener("pagehide", onHide);
  };
}
