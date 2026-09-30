import { defineConfig } from "vitest/config";
import { defaultServerConditions } from "vite";

export default defineConfig({
  // Resolve the workspace packages to their TypeScript source, no build needed.
  resolve: { conditions: ["source", ...defaultServerConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: { testTimeout: 15_000, fileParallelism: false },
});
