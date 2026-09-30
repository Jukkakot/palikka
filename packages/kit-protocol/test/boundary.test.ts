import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The kit's boundary, for what lint cannot express: every relative import in a kit package stays
 * inside that package. (Lint forbids the game packages and paths three or more levels up.)
 */

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const kitPackages = readdirSync(packagesDir).filter((name) => name.startsWith("kit-"));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

describe("kit boundary", () => {
  it("finds the kit packages", () => {
    expect(kitPackages).toEqual(expect.arrayContaining(["kit-protocol", "kit-server", "kit-client"]));
  });

  it.each(kitPackages)("%s imports nothing outside itself", (name) => {
    const root = join(packagesDir, name);
    const outside = sourceFiles(root).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(IMPORT)]
        .map((m) => m[1]!)
        .filter((spec) => relative(root, resolve(dirname(file), spec)).startsWith(".."))
        .map((spec) => `${relative(root, file)}: ${spec}`),
    );
    expect(outside).toEqual([]);
  });
});
