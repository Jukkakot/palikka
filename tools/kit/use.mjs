// Points Palikka at one game-kit version (docs/development.md → Game kit).
//
//   npm run kit:use -- 0.2.0          the release tarballs of v0.2.0
//   npm run kit:use -- local [path]   a local kit checkout (default ../game-kit), packed there
//
// Rewrites every @game-kit/* dependency of the workspaces and runs npm install. A local setup
// must not be committed: `npm run lint` refuses it (tools/kit/check.mjs).
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { KIT_REPO, ROOT, workspaceManifests } from "./workspaces.mjs";

const [target, localPath = "../game-kit"] = process.argv.slice(2);
if (!target || (target !== "local" && !/^\d+\.\d+\.\d+$/.test(target))) {
  console.error("Usage: npm run kit:use -- <version> | local [path]");
  process.exit(1);
}

const tarball = (name, version) => `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
let spec;
if (target === "local") {
  const kit = resolve(ROOT, localPath);
  execSync("npm run pack -- --local", { cwd: kit, stdio: "inherit" });
  const version = JSON.parse(readFileSync(join(kit, "packages/protocol/package.json"), "utf8")).version;
  spec = (name) => `file:${join(kit, ".release", tarball(name, version)).replaceAll("\\", "/")}`;
} else {
  spec = (name) => `https://github.com/${KIT_REPO}/releases/download/v${target}/${tarball(name, target)}`;
}

for (const { path, manifest } of workspaceManifests()) {
  let changed = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (!name.startsWith("@game-kit/")) continue;
      manifest[field][name] = spec(name);
      changed = true;
    }
  }
  if (changed) writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

// A local tarball keeps its name between packs: drop the installed copy so npm takes the new one.
rmSync(join(ROOT, "node_modules/@game-kit"), { recursive: true, force: true });
execSync("npm install --no-audit --no-fund", { cwd: ROOT, stdio: "inherit" });
console.log(`Palikka now uses game-kit ${target === "local" ? `from ${localPath} (do not commit)` : `v${target}`}`);
