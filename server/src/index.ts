import { listen } from "@colyseus/tools";
import app from "./app.config.js";
import { installProcessHandlers, log } from "@game-kit/server";

installProcessHandlers();

// Listens on PORT (Render sets it) or 2577 by default (not Colyseus' 2567, so it runs next to other games).
const port = Number(process.env.PORT ?? 2577);
const server = await listen(app, port);
log.info("server.started", { port });

server.onBeforeShutdown(() => {
  log.info("server.shutdown");
});
