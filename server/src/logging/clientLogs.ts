import express, { type Application, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { clientLogBatchSchema } from "@labyrinth/protocol";
import { log } from "./logger.js";

/** Upper bound for a batch body (50 entries at maximum field sizes stay below this). */
const MAX_BODY = "600kb";

export const CLIENT_LOG_RATE = { windowMs: 60_000, limit: 30 } as const;

function reject(res: Response): void {
  res.status(400).json({ error: "invalid batch" });
}

function handle(req: Request, res: Response): void {
  if (typeof req.body !== "string") return reject(res);

  let json: unknown;
  try {
    json = JSON.parse(req.body);
  } catch {
    return reject(res);
  }

  const parsed = clientLogBatchSchema.safeParse(json);
  if (!parsed.success) return reject(res);

  for (const entry of parsed.data.entries) log.client(entry, parsed.data.ver);
  res.status(204).end();
}

/** Body-parser errors (e.g. too large) become the same 400 as any invalid batch. */
function bodyErrors(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err) reject(res);
  else next();
}

/**
 * `POST /client-logs`: client log batches written into the server log stream.
 * The body is JSON sent as text/plain (no CORS preflight). Rate-limited per IP;
 * the IP is only used in memory and never logged.
 */
export function mountClientLogs(app: Application): void {
  const limiter = rateLimit({ ...CLIENT_LOG_RATE, standardHeaders: "draft-8", legacyHeaders: false });
  app.post("/client-logs", limiter, express.text({ type: () => true, limit: MAX_BODY }), bodyErrors, handle);
}
