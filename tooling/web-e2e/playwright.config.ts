import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./src",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Playwright starts the web app (reused locally if already running). The CI
  // workflow provisions Supabase + the .env before this runs.
  webServer: {
    command: "pnpm --filter @acme/nextjs dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
