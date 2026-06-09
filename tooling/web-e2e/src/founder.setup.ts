import { expect, test } from "@playwright/test";

/**
 * Setup project — provisions the FOUNDER and asserts the seed-on-signup flow.
 *
 * Requires a FRESH/empty DB (CI starts empty; locally run `supabase db reset`).
 * The first sign-up becomes the owner (`is_staff = true`), so sign-up MUST route
 * through `/welcome` into the CMS seed flow (`/cms-setup`, the shadcn progress
 * bar) and reach `/admin` only after seeding completes. This asserts that flow
 * end-to-end AND leaves a founder + seeded CMS in place, so every other spec's
 * sign-up is a NON-staff user that lands on `/dashboard` and content.spec has
 * data to render.
 *
 * Strict on purpose: the founder MUST reach `/cms-setup` (not `/dashboard`). A
 * regression in `/welcome` routing or the `is_staff` flag would send them to
 * `/dashboard` — this test then fails loudly instead of passing silently.
 */
test("founder sign-up seeds the CMS before /admin", async ({ page }) => {
  const email = `founder-${Date.now()}@test.local`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Founder");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create Account" }).click();

  // The founder (first user) must be routed into the seed flow — NOT /dashboard.
  await page.waitForURL(/\/cms-setup/, { timeout: 15_000 });

  // The shadcn progress screen, then hand-off to /admin once seeding completes.
  // Seeding + the Payload admin bundle can be slow on a cold CI runner.
  await expect(
    page.getByRole("heading", { name: /setting up your cms/i }),
  ).toBeVisible();
  await page.waitForURL(/\/admin/, { timeout: 90_000 });

  // Directly assert the seed actually populated the CMS — not just that we
  // redirected. The status endpoint reports `seeded: true` once pages exist, and
  // uses the founder's authenticated session (cookies shared from the context).
  const status = await page.request.get("/api/cms/seed");
  expect(status.ok()).toBeTruthy();
  const body = (await status.json()) as { seeded?: boolean };
  expect(body.seeded).toBe(true);
});
