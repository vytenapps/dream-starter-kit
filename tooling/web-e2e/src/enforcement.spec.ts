import { expect, test } from "@playwright/test";

import { signUpAndConfirm } from "./helpers/mailpit";

/**
 * Enforcement boundaries the happy-path specs don't assert directly:
 *
 * 1. Extension API routes are authed (golden rule #6) — the dispatcher
 *    (/api/ext/[ext]/...) rejects anonymous calls with 401 before any
 *    extension handler runs; chat's stream route is the canonical case.
 * 2. Payload admin is default-deny — a signed-in NON-staff user is bounced from
 *    /admin back into the app. admin-login.spec.ts covers the staff allow-path;
 *    this is the deny-path (proxy.ts redirects non-staff to /a).
 */

test("POST /api/ext/chat/stream without a token is rejected (401)", async ({
  request,
}) => {
  const res = await request.post("/api/ext/chat/stream", {
    data: { threadId: "00000000-0000-0000-0000-000000000000", text: "hi" },
  });
  expect(res.status()).toBe(401);
});

test("an unknown extension API 404s", async ({ request }) => {
  const res = await request.post("/api/ext/nope/anything");
  expect(res.status()).toBe(404);
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
