import express, { type Application, type Request, type Response } from "express";
import { matchMaker } from "colyseus";
import { watchRequestSchema, type GameMetadata, type JoinOptions } from "@game-kit/protocol";

/**
 * `POST /watch { roomId, nickname }`: a seat reservation for watching a running game. A started
 * game is locked, so the matchmaker's joinById refuses everyone; the room itself admits a
 * spectator (`watch` in the join's auth) while its listing says it is watchable. The body is JSON
 * sent as text/plain (no CORS preflight). 400 bad body, 404 no such game, 409 not watchable now.
 */
async function handle(roomName: string, req: Request, res: Response): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse(typeof req.body === "string" ? req.body : "");
  } catch {
    json = undefined;
  }
  const parsed = watchRequestSchema.safeParse(json);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_OPTIONS" });
    return;
  }
  const [room] = await matchMaker.query({ roomId: parsed.data.roomId, name: roomName });
  if (!room) {
    res.status(404).json({ error: "NOT_WATCHABLE" });
    return;
  }
  if (!(room.metadata as GameMetadata | undefined)?.watchable) {
    res.status(409).json({ error: "NOT_WATCHABLE" });
    return;
  }
  const options: JoinOptions = { nickname: parsed.data.nickname, watch: true };
  try {
    res.json(await matchMaker.reserveSeatFor(room, options, options));
  } catch {
    // Full of spectators, or gone meanwhile.
    res.status(409).json({ error: "NOT_WATCHABLE" });
  }
}

/** Mounts `POST /watch` for the game rooms defined as `roomName`. */
export function mountWatch(app: Application, roomName = "game"): void {
  app.post("/watch", express.text({ type: () => true, limit: "2kb" }), (req, res, next) => {
    handle(roomName, req, res).catch(next);
  });
}
