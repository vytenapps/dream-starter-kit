import { expect, test } from "@playwright/test";

import { signUpAndConfirm } from "./helpers/mailpit";

/**
 * Critical-path e2e: sign up, then schedule a reminder end-to-end — a kept,
 * RLS-backed Supabase feature (the example projects→items domain was replaced
 * by the Payload CMS; see content.spec.ts for the public content path).
 *
 * Runs against a LIVE local Supabase (`supabase start`, email confirmations ON
 * — links pulled from Mailpit) + the web app. In CI the workflow provisions
 * both (Phase 8). Locally:
 *   supabase start && pnpm dev:next   # then: pnpm test:e2e
 */
test("sign up → schedule a reminder", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.local`;

  // Sign up + confirm via the emailed link; a non-staff user (the founder
  // already exists from founder.setup.ts) lands on the dashboard.
  await signUpAndConfirm(page, { name: "E2E User", email });
  await expect(page).toHaveURL(/\/dashboard/);

  // Schedule a reminder.
  await page.goto("/reminders");
  // Wait for the client app to hydrate before interacting — otherwise the
  // submit can fire before its handler is attached and silently no-op.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("When").fill("2030-01-01T10:00");
  await page.getByRole("button", { name: "Schedule reminder" }).click();

  // The new reminder appears in the list with a pending status (insert →
  // react-query refetch → render; give it room on a loaded CI runner).
  await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 15_000 });
});
