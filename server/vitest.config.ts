import { defineConfig } from "vitest/config";
import { defaultServerConditions } from "vite";

export default defineConfig({
  resolve: {
    // Resolve @palikka/rules to its TypeScript source, no build needed.
    conditions: ["source", ...defaultServerConditions],
  },
  ssr: {
    resolve: {
      conditions: ["source", ...defaultServerConditions],
    },
  },
  test: {
    testTimeout: 15_000,
    // Each file boots a real Colyseus server; run files one at a time to avoid port clashes.
    fileParallelism: false,
  },
});
