import { expect, test } from "@playwright/test";

import { readFounderEmail } from "./helpers/founder";
import { signInWithPasswordUI } from "./helpers/mailpit";

/**
 * Admin sign-IN routing: an existing staff/admin user who logs in lands in the
 * CMS admin, not the app dashboard. Sign-in defaults to /welcome, which routes
 * by role — staff go STRAIGHT to /admin once the CMS is seeded (it was, by
 * founder.setup.ts); the /cms-setup seed screen is a one-time founder
 * experience and must never reappear. Everyone else → /a (covered by
 * auth.spec.ts).
 *
 * Uses the founder credentials persisted by founder.setup.ts (password is the
 * suite-wide default).
 */
test("signing in as the admin lands in /admin", async ({ page }) => {
  // First /admin paint can be slow on a cold dev server.
  test.setTimeout(120_000);

  const email = await readFounderEmail();

  // Regression guard: a returning admin must not be routed through the
  // "Setting up your CMS" screen again.
  const visited: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });

  await signInWithPasswordUI(page, email);

  await page.waitForURL(/\/admin/, { timeout: 60_000 });
  expect(visited.filter((url) => url.includes("/cms-setup"))).toEqual([]);
  // Assert the Payload admin actually rendered for this user (not just the
  // URL). Generous timeout: the admin shell's data fetches crawl when the dev
  // server is busy compiling for parallel workers.
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
});
