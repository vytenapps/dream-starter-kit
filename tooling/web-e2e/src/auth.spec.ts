import { expect, test } from "@playwright/test";

import {
  fetchAuthEmail,
  signUpAndConfirm,
  signUpToCheckEmail,
} from "./helpers/mailpit";

// Run this file's tests sequentially (one worker): every test starts with a
// sign-up, and firing all three simultaneously can push local GoTrue past its
// 10s request deadline (each signup sends a confirmation email) → 504s. Other
// spec files still run in parallel; "default" (unlike "serial") doesn't skip
// the remaining tests when one fails.
test.describe.configure({ mode: "default" });

/**
 * Auth e2e against local Supabase. The kit ships an EMPTY seed (no seeded
 * accounts) so tests sign UP fresh accounts rather than signing in to seed
 * data (the founder already exists — see founder.setup.ts — so these are
 * non-staff users). Email confirmations are ON (`supabase/config.toml`,
 * matching hosted Supabase): sign-up lands on /check-email and is completed
 * either by the emailed link or the emailed 6-digit code, both pulled from
 * Mailpit. Each test uses a unique email so repeated runs against the same DB
 * don't collide.
 */
function uniqueEmail() {
  return `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("signing up + confirming via the email link lands on the dashboard", async ({
  page,
}) => {
  await signUpAndConfirm(page, { name: "E2E User", email: uniqueEmail() });
  await expect(page).toHaveURL(/\/dashboard/);
});

test("signing up + entering the email code manually lands on the dashboard", async ({
  page,
}) => {
  const email = uniqueEmail();
  await signUpToCheckEmail(page, { name: "E2E User", email });

  // The manual path: the same email carries a 6-digit code (verifyOtp — not
  // PKCE-coupled, so unlike the link it would work from any browser).
  await page.getByRole("button", { name: "Enter code manually" }).click();
  const { code } = await fetchAuthEmail(email);
  expect(code).toBeTruthy();
  await page.getByPlaceholder("Enter code").fill(code ?? "");
  await page.getByRole("button", { name: "Continue with login code" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
});

test("a signed-in user is bounced away from auth pages", async ({ page }) => {
  await signUpAndConfirm(page, { name: "E2E User", email: uniqueEmail() });
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard/);
});
