// PostToolUse hook for Claude Code: lints a TypeScript file right after Claude edits it, so a lint
// problem (warnings included; the repo has none) shows up at once instead of in the check chain.
// Exit code 2 hands the findings back to Claude; anything else (not a .ts/.tsx file, oxlint
// missing) passes silently.
import { spawnSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input || "{}").tool_input?.file_path;
if (typeof file !== "string" || !/\.(ts|tsx)$/.test(file) || file.includes("node_modules")) process.exit(0);

const result = spawnSync("npx", ["oxlint", "--deny-warnings", file], { encoding: "utf8", shell: true });
if (result.status === 1) {
  process.stderr.write(`oxlint found problems in ${file}:\n${result.stdout}${result.stderr}`);
  process.exit(2);
}
process.exit(0);
