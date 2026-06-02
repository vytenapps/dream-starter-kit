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
  // In CI the workflow starts Supabase + the web app; locally, run
  // `supabase start` and `pnpm dev:next` first (reused if already running).
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm --filter @acme/nextjs dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
