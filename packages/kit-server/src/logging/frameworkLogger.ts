import { format } from "node:util";
import { log } from "./logger.js";

/** Formats Colyseus's console-style arguments into one message plus an optional error. */
function toLine(args: unknown[]) {
  const err = args.find((a): a is Error => a instanceof Error);
  const rest = args.filter((a) => a !== err);
  return { msg: format(...rest).trim() || err?.message || "", err };
}

function write(level: "debug" | "info" | "warn" | "error", args: unknown[]) {
  try {
    const { msg, err } = toLine(args);
    if (!msg && !err) return; // Colyseus prints blank spacer lines.
    log[level]("framework.log", err ? { err } : undefined, msg);
  } catch {
    // Logging must never break the framework.
  }
}

/** Routes Colyseus's own logging through our JSON logger as `framework.log`. */
export const frameworkLogger = {
  trace: (...args: unknown[]) => write("debug", args),
  debug: (...args: unknown[]) => write("debug", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
};
