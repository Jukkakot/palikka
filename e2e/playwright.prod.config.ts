import { defineConfig, devices } from "@playwright/test";

/**
 * Production smoke against the live site (`PROD_URL`, default the GitHub Pages address). No local
 * servers; only `prod.spec.ts` runs. Started by `.github/workflows/prod-smoke.yml`.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /prod\.spec\.ts$/,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PROD_URL ?? "https://jukkakot.github.io/palikka/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "galaxy-s24", use: { ...devices["Galaxy S24"] } }],
});
