import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./src",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI: annotate the run via the `github` reporter AND emit the static HTML
  // report into `playwright-report/` (default dir) so the workflow's
  // upload-artifact step has files to publish. `open: "never"` keeps it from
  // trying to launch a browser on failure. Local: concise `list` output.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Tests run against `next dev`, where parallel workers all trigger
  // first-compiles of their routes — the 30s default times tests out on the
  // email-confirmation flows (sign-up → Mailpit → verify-link redirect chain).
  timeout: 120_000,
  // Local: cap the worker count — most specs start by signing up, and
  // concurrent signups (each sending a confirmation email inside GoTrue's
  // request window) compete with `next dev` compiles for CPU and can push
  // local GoTrue past its 10s gateway deadline (504s). CI keeps Playwright's
  // default (cores/2).
  workers: process.env.CI ? undefined : 2,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Runs first: provisions the founder (first sign-up) + seeds the CMS, so the
    // parallel suite below sees an existing founder and seeded content. See
    // src/founder.setup.ts.
    { name: "setup", testMatch: /founder\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /founder\.setup\.ts/,
      dependencies: ["setup"],
    },
  ],
  // Playwright starts the web app (reused locally if already running). The CI
  // workflow provisions Supabase + the .env before this runs.
  webServer: {
    command: "pnpm --filter @acme/nextjs dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Exercise the Cloudflare Turnstile path in e2e with the always-pass test
    // site key (https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
    // unless the env already provides one. The widget solves silently; Supabase
    // CAPTCHA stays OFF locally (config.toml), so the token is accepted-and-ignored
    // — anon sign-in / sign-up / favorites all work without a live challenge.
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY:
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
        "1x00000000000000000000AA",
    },
  },
});
