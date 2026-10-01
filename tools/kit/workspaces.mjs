import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_REPO = "Jukkakot/game-kit";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The root and every workspace package.json, parsed. */
export function workspaceManifests() {
  const rootPath = join(ROOT, "package.json");
  const root = JSON.parse(readFileSync(rootPath, "utf8"));
  return [rootPath, ...root.workspaces.map((ws) => join(ROOT, ws, "package.json"))].map((path) => ({
    path,
    manifest: JSON.parse(readFileSync(path, "utf8")),
  }));
}
