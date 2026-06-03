import { expect, test } from "@playwright/test";

/**
 * Public content (Payload CMS) smoke. Requires the Payload schema + demo seed
 * alongside the running web app:
 *   supabase start && pnpm cms:migrate && pnpm cms:seed && pnpm dev:next
 * Assertions stay structural (headers/headings) so they don't depend on exact
 * seeded copy.
 */
test.describe("public content", () => {
  test("home renders inside the public chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("articles list renders", async ({ page }) => {
    await page.goto("/articles");
    await expect(
      page.getByRole("heading", { name: /articles/i }),
    ).toBeVisible();
  });

  test("a static page renders from the CMS", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
