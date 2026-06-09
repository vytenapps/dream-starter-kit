import { expect, test } from "@playwright/test";

/**
 * Public content (Payload CMS) smoke. Requires the Payload schema + demo seed
 * alongside the running web app:
 *   supabase start && pnpm cms:migrate && pnpm cms:seed && pnpm dev:next
 * Assertions stay structural (headers/headings) so they don't depend on exact
 * seeded copy.
 */
test.describe("public content", () => {
  test("home renders the hero inside the public chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    // The Launch UI hero renders the page's leading <h1>.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("articles list renders", async ({ page }) => {
    await page.goto("/articles");
    await expect(
      page.getByRole("heading", { name: /articles/i }),
    ).toBeVisible();
  });

  test("a static page renders its CMS blocks", async ({ page }) => {
    await page.goto("/about");
    // The prose block renders a heading containing the page's name.
    await expect(page.getByRole("heading", { name: /about/i })).toBeVisible();
  });
});
