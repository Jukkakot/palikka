import { log } from "./logger.js";

/**
 * Logs process-level failures as single JSON lines. An uncaught exception
 * leaves the process in an unknown state, so it exits and Render restarts it;
 * room errors never get here (rooms catch them in onUncaughtException).
 */
export function installProcessHandlers(proc: Pick<NodeJS.Process, "on" | "exit"> = process): void {
  proc.on("uncaughtException", (err: Error) => {
    log.error("process.uncaughtException", { err });
    proc.exit(1);
  });
  proc.on("unhandledRejection", (reason: unknown) => {
    log.error("process.unhandledRejection", { err: reason });
  });
}
