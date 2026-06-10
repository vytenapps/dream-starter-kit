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
    // Landmark roles, not bare header/footer locators: Next's dev-tools
    // overlay injects its own <footer>, which trips strict mode — but nested
    // inside the overlay it doesn't get the banner/contentinfo role.
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
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
