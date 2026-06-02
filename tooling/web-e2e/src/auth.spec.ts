import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Auth e2e against the seeded local Supabase. `supabase/seed.sql` creates these
 * accounts with confirmed emails and a GoTrue-compatible bcrypt password, so
 * password sign-in works out of the box (see Phase 8 CI provisioning).
 */
const SEED_EMAIL = "user.a@example.com";
const SEED_PASSWORD = "password123";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(SEED_EMAIL);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("sign in with a seeded account lands on the dashboard", async ({
  page,
}) => {
  await signIn(page);
});

test("a signed-in user is bounced away from auth pages", async ({ page }) => {
  await signIn(page);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard/);
});
