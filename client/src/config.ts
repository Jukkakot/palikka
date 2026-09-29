const DEV_SERVER_URL = "http://localhost:2567";

interface ServerUrlEnv {
  VITE_SERVER_URL?: string;
  PROD: boolean;
}

export function resolveServerUrl(env: ServerUrlEnv): string {
  const url = env.VITE_SERVER_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  if (!env.PROD) return DEV_SERVER_URL;
  throw new Error("VITE_SERVER_URL is not set for this production build");
}

/** Server base URL. Resolved on use so a build without it still loads until it connects. */
export function serverUrl(): string {
  return resolveServerUrl(import.meta.env);
}

/** When this client was built (UTC ISO), or `null` for a development build. */
export function clientBuiltAt(): string | null {
  return __BUILD_TIME__;
}
