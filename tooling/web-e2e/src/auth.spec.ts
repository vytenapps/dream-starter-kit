import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Auth e2e against local Supabase. The kit ships an EMPTY seed (no seeded
 * accounts) so the first UI signup becomes the owner — these tests therefore
 * sign UP a fresh account rather than signing in to seed data. Local Supabase
 * has email confirmations disabled (`supabase/config.toml`), so a new account is
 * immediately usable and lands on the dashboard. Each test uses a unique email
 * so repeated runs against the same DB don't collide.
 */
function uniqueEmail() {
  return `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}
const PASSWORD = "password123";

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("signing up lands on the dashboard", async ({ page }) => {
  await signUp(page, uniqueEmail());
});

test("a signed-in user is bounced away from auth pages", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/dashboard/);
});
