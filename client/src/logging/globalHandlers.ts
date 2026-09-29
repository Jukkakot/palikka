import { log as defaultLog } from "./logger.ts";

type ErrorLogger = Pick<typeof defaultLog, "error">;

function describe(reason: unknown): { msg: string; stack?: string } {
  if (reason instanceof Error) return { msg: reason.message, stack: reason.stack };
  return { msg: typeof reason === "string" ? reason : JSON.stringify(reason) ?? String(reason) };
}

/** Logs uncaught errors and unhandled promise rejections as `client.error`. */
export function installGlobalErrorHandlers(target: Window = window, logger: ErrorLogger = defaultLog): () => void {
  const onError = (event: ErrorEvent) => {
    const { msg, stack } = describe(event.error ?? event.message);
    logger.error("client.error", { stack, source: event.filename, line: event.lineno, kind: "error" }, msg);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const { msg, stack } = describe(event.reason);
    logger.error("client.error", { stack, kind: "unhandledrejection" }, msg);
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
