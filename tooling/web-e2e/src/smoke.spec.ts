import { expect, test } from "@playwright/test";

/**
 * Smoke + route-protection checks. These hit no forms, so they're resilient to
 * UI changes and assert the middleware (`proxy.ts`) + public wiring.
 */
test.describe("smoke", () => {
  test("public landing renders with a sign-in entry point", async ({
    page,
  }) => {
    await page.goto("/");
    // The public header and the home hero both link to /sign-in — assert the
    // first match (multiple is expected) rather than tripping strict mode.
    await expect(page.locator('a[href="/sign-in"]').first()).toBeVisible();
  });

  test("a protected route redirects to sign-in when signed out", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
    // The original destination is preserved for post-login redirect.
    await expect(page).toHaveURL(/redirectTo=%2Fdashboard/);
  });
});
