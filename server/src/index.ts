import { listen } from "@colyseus/tools";
import app from "./app.config.js";
import { log } from "./logging/logger.js";
import { installProcessHandlers } from "./logging/processHandlers.js";

installProcessHandlers();

// Listens on PORT (Render sets it) or 2567 by default.
const server = await listen(app);
log.info("server.started", { port: Number(process.env.PORT ?? 2567) });

server.onBeforeShutdown(() => {
  log.info("server.shutdown");
});
