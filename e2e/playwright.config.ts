import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

/**
 * E2E against the real dev server and client. Every test plays in its own
 * quick-play pool (`?pool=…`), so tests never meet each other's players.
 */
export default defineConfig({
  testDir: "./tests",
  // The production smoke has its own config (playwright.prod.config.ts).
  testIgnore: /prod\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5183",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "galaxy-s24", use: { ...devices["Galaxy S24"] } }],
  webServer: [
    {
      command: "npm run dev -w @palikka/server",
      cwd: "..",
      url: "http://localhost:2577/health",
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -w @palikka/client",
      cwd: "..",
      url: "http://localhost:5183",
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
