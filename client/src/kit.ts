import { configureKit } from "@game-kit/client";
import { CLIENT_KEY_EVENTS } from "@palikka/protocol";
import { serverUrl } from "./config.ts";

// Palikka's own client log event, next to the kit's.
declare module "@game-kit/client" {
  interface GameClientLogEvents {
    "client.puzzle.solved": true;
  }
}

/** Tells the game kit's client about Palikka: storage keys, server, version and key log events. */
export function configurePalikkaKit(): void {
  configureKit({
    storagePrefix: "palikka",
    serverUrl,
    clientVersion: () => import.meta.env.VITE_APP_VERSION || "dev",
    keyEvents: CLIENT_KEY_EVENTS,
  });
}

configurePalikkaKit();
