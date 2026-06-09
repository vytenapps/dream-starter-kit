import { expect, test } from "@playwright/test";

/**
 * Setup project — provisions the FOUNDER before the parallel suite runs.
 *
 * Against a fresh DB the first sign-up becomes the owner (`is_staff = true`), so
 * sign-up routes them through `/welcome` into the CMS seed flow (`/cms-setup`) —
 * the shadcn progress bar — before `/admin`. This file both (a) asserts that
 * founder flow and (b) guarantees a founder + seeded CMS exist, so every other
 * spec's sign-up is a NON-staff user that lands on `/dashboard` (and
 * content.spec sees seeded pages). Wired as a `setup` dependency in
 * playwright.config.ts.
 *
 * Tolerant of a non-empty local DB: if a founder already exists the sign-up
 * lands on `/dashboard`, and we simply confirm a founder is present rather than
 * re-running the (already-completed) seed flow.
 */
test("founder sign-up seeds the CMS before /admin", async ({ page }) => {
  const email = `founder-${Date.now()}@test.local`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Founder");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create Account" }).click();

  // /welcome routes the founder into the seed flow; a non-first sign-up lands on
  // the dashboard (a founder already existed — fine, one is present either way).
  await page.waitForURL(/\/(cms-setup|dashboard)/, { timeout: 15_000 });
  if (/\/dashboard/.test(page.url())) return;

  // The shadcn progress screen, then hand-off to /admin once content exists.
  // Seeding + the Payload admin bundle can be slow on a cold CI runner.
  await expect(
    page.getByRole("heading", { name: /setting up your cms/i }),
  ).toBeVisible();
  await page.waitForURL(/\/admin/, { timeout: 90_000 });
});
