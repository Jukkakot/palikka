import { defineConfig } from "vitest/config";
import { defaultServerConditions } from "vite";

export default defineConfig({
  resolve: {
    // Resolve the workspace packages to their TypeScript source, no build needed.
    conditions: ["source", ...defaultServerConditions],
  },
  ssr: {
    resolve: {
      conditions: ["source", ...defaultServerConditions],
    },
  },
});
