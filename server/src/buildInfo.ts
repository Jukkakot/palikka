import { readFileSync } from "node:fs";

/** Written next to the compiled server by the `build` script; absent in `tsx` dev and tests. */
export const BUILD_INFO_URL = new URL("./build-info.json", import.meta.url);

/** The server's build time (UTC ISO), or `null` when it runs without a build. */
export function readBuiltAt(file: URL | string = BUILD_INFO_URL): string | null {
  try {
    const info = JSON.parse(readFileSync(file, "utf8")) as { builtAt?: unknown };
    return typeof info.builtAt === "string" ? info.builtAt : null;
  } catch {
    return null;
  }
}
