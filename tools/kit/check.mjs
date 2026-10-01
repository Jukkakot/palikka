// Part of `npm run lint`: game-kit comes from a release, never from a local checkout
// (`kit:use local` is for trying kit changes, not for committing).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, workspaceManifests } from "./workspaces.mjs";

const problems = [];
for (const { path, manifest } of workspaceManifests()) {
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith("@game-kit/") && !spec.startsWith("https://github.com/")) {
        problems.push(`${path.slice(ROOT.length + 1)}: ${name} → ${spec}`);
      }
    }
  }
}
const lock = readFileSync(join(ROOT, "package-lock.json"), "utf8");
if (/"resolved": "file:[^"]*game-kit/.test(lock) || /"@game-kit\/[^"]+": "file:/.test(lock)) {
  problems.push("package-lock.json: a local game-kit tarball");
}

if (problems.length > 0) {
  console.error("game-kit must come from a release (npm run kit:use -- <version>):");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
