import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { log } from "./logger.js";

/** Paths hit by the platform's health checks: logged at debug only. */
const QUIET_PATHS = new Set(["/health"]);

function audit(req: IncomingMessage, res: ServerResponse): void {
  const start = performance.now();
  res.on("finish", () => {
    const path = (req.url ?? "/").split("?")[0]!;
    const fields = {
      method: req.method,
      path,
      status: res.statusCode,
      durMs: Math.round((performance.now() - start) * 10) / 10,
    };
    if (QUIET_PATHS.has(path)) log.debug("http.request", fields);
    else if (res.statusCode >= 500) log.error("http.request", fields);
    else log.info("http.request", fields);
  });
}

/**
 * Logs exactly one `http.request` line per request. Attached to the Node HTTP
 * server itself because Colyseus answers matchmaking requests before Express.
 */
export function attachHttpAudit(server: Server | undefined): void {
  if (!server) throw new Error("HTTP audit needs the transport's http.Server");
  server.on("request", audit);
}
