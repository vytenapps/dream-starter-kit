import { expect, test } from "@playwright/test";

import { readFounderEmail } from "./helpers/founder";

/**
 * Admin sign-IN routing: an existing staff/admin user who logs in lands in the
 * CMS admin, not the app dashboard. Sign-in defaults to /welcome, which routes
 * by role — staff → /cms-setup (already seeded by founder.setup.ts, so it
 * forwards straight on) → /admin; everyone else → /dashboard (covered by
 * auth.spec.ts).
 *
 * Uses the founder credentials persisted by founder.setup.ts (password is the
 * suite-wide default).
 */
test("signing in as the admin lands in /admin", async ({ page }) => {
  // First /admin paint can be slow on a cold dev server.
  test.setTimeout(120_000);

  const email = await readFounderEmail();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL(/\/admin/, { timeout: 60_000 });
  // Assert the Payload admin actually rendered for this user (not just the URL).
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
});
