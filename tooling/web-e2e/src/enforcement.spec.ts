import { expect, test } from "@playwright/test";

import { signUpAndConfirm } from "./helpers/mailpit";

/**
 * Enforcement boundaries the happy-path specs don't assert directly:
 *
 * 1. AI routes are authed (golden rule #6) — POST /api/chat with no bearer
 *    token is rejected with 401. (CI sets a dummy AI_GATEWAY_API_KEY so the
 *    route gets past its "is AI configured?" 503 guard to the auth check.)
 * 2. Payload admin is default-deny — a signed-in NON-staff user is bounced from
 *    /admin back into the app. admin-login.spec.ts covers the staff allow-path;
 *    this is the deny-path (proxy.ts redirects non-staff to /a).
 */

test("POST /api/chat without a token is rejected (401)", async ({
  request,
}) => {
  const res = await request.post("/api/chat", {
    data: { threadId: "00000000-0000-0000-0000-000000000000", text: "hi" },
  });
  expect(res.status()).toBe(401);
});

test("a non-staff user is bounced from /admin to the app", async ({ page }) => {
  // First /admin hit can be slow to compile on a cold dev server.
  test.setTimeout(120_000);

  const email = `e2e-nonstaff-${Date.now()}@test.local`;

  // The founder already exists (founder.setup.ts), so this fresh signup is a
  // non-staff user and lands on the dashboard.
  await signUpAndConfirm(page, { name: "Non Staff", email });
  await expect(page).toHaveURL(/\/a(?:[/?#]|$)/);

  // Attempting to open the CMS admin redirects non-staff back to /a,
  // and Payload's admin chrome (e.g. the Users nav link) never renders.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/a(?:[/?#]|$)/);
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
});
