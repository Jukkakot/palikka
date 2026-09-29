import { matchMaker } from "colyseus";

/** Dev servers on this machine or the LAN (phones testing `vite --host`). */
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}):\d+$/;

const ALLOW_ORIGIN = "Access-Control-Allow-Origin";

/** Parses the comma-separated ALLOWED_ORIGINS list. */
export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string, allowed: string[], isProduction: boolean): boolean {
  return allowed.includes(origin) || (!isProduction && DEV_ORIGIN.test(origin));
}

/**
 * Colyseus adds CORS headers to every HTTP response (matchmaking and Express
 * routes) and by default echoes any Origin. Restrict it to the allow-list.
 */
export function configureCors(env: NodeJS.ProcessEnv = process.env) {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const isProduction = env.NODE_ENV === "production";
  const { controller } = matchMaker;

  delete (controller.DEFAULT_CORS_HEADERS as Record<string, string>)[ALLOW_ORIGIN];
  controller.getCorsHeaders = (headers: Headers): Record<string, string> => {
    const origin = headers.get("origin");
    return origin && isOriginAllowed(origin, allowed, isProduction)
      ? { [ALLOW_ORIGIN]: origin, Vary: "Origin" }
      : {};
  };
}
