import { expect, test } from "@playwright/test";

/**
 * Public pricing page smoke. Requires the Payload schema + demo seed (which
 * seeds the three default plans) alongside the running web app:
 *   supabase start && pnpm cms:migrate && pnpm cms:seed && pnpm dev:next
 * Assertions stay structural so they don't depend on exact seeded copy.
 */
test.describe("pricing", () => {
  test("renders the seeded plans inside the public chrome", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();

    // The three default plans are seeded and featured.
    await expect(page.getByText(/dream monthly plan/i)).toBeVisible();
    await expect(page.getByText(/dream annual plan/i)).toBeVisible();
    await expect(page.getByText(/dream lifetime plan/i)).toBeVisible();
  });

  test("the free tier links to sign-up", async ({ page }) => {
    await page.goto("/pricing");
    const getStarted = page.getByRole("link", { name: /get started/i }).first();
    await expect(getStarted).toHaveAttribute("href", /\/sign-up/);
  });
});
