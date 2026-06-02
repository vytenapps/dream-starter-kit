import { expect, test } from "@playwright/test";

/**
 * Smoke + route-protection checks. These hit no forms, so they're resilient to
 * UI changes and assert the middleware (`proxy.ts`) + landing wiring.
 */
test.describe("smoke", () => {
  test("landing page renders with auth entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/sign-in"]')).toBeVisible();
    await expect(page.locator('a[href="/sign-up"]')).toBeVisible();
  });

  test("a protected route redirects to sign-in when signed out", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/sign-in/);
    // The original destination is preserved for post-login redirect.
    await expect(page).toHaveURL(/redirectTo=%2Fprojects/);
  });
});
