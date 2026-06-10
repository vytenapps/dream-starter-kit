import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { fetchAuthUserByEmail, fetchProfile } from "./helpers/db";
import { FOUNDER_META, FOUNDER_STORAGE_STATE } from "./helpers/founder";
import { signUpAndConfirm } from "./helpers/mailpit";

/**
 * Setup project — provisions the FOUNDER and asserts the seed-on-signup flow.
 *
 * Requires a FRESH/empty DB (CI starts empty; locally run `supabase db reset`).
 * Email confirmations are ON (matching hosted Supabase), so sign-up first lands
 * on /check-email and is completed via the confirmation link pulled from
 * Mailpit. The first sign-up becomes the owner (`is_staff = true`), so it MUST
 * then route through `/welcome` into the CMS seed flow (`/cms-setup`, the
 * shadcn progress bar) and reach `/admin` only after seeding completes. This
 * asserts that flow end-to-end AND leaves a founder + seeded CMS in place, so
 * every other spec's sign-up is a NON-staff user that lands on `/dashboard`
 * and content.spec has data to render.
 *
 * Strict on purpose: the founder MUST reach `/cms-setup` (not `/dashboard`). A
 * regression in `/welcome` routing or the `is_staff` flag would send them to
 * `/dashboard` — this test then fails loudly instead of passing silently.
 */
test("founder sign-up seeds the CMS before /admin", async ({ page }) => {
  // Well past the default 30s: confirmation email round-trip + CMS seeding +
  // the Payload admin bundle's first compile on a cold dev server.
  test.setTimeout(180_000);

  const email = `founder-${Date.now()}@test.local`;

  await signUpAndConfirm(page, { name: "Founder", email });

  // The founder (first user) must be routed into the seed flow — NOT /dashboard.
  await page.waitForURL(/\/cms-setup/, { timeout: 15_000 });

  // The shadcn progress screen, then hand-off to /admin once seeding completes.
  // Seeding + the Payload admin bundle can be slow on a cold CI runner.
  await expect(
    page.getByRole("heading", { name: /setting up your cms/i }),
  ).toBeVisible();
  await page.waitForURL(/\/admin/, { timeout: 90_000 });

  // The founder can actually VIEW /admin — the Payload dashboard must render
  // for them (the supabase-strategy bridge provisioned a cms.users row), not
  // just resolve the URL. Generous: first admin paint compiles a big bundle.
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toBeVisible({ timeout: 60_000 });

  // Directly assert the seed actually populated the CMS — not just that we
  // redirected. The status endpoint reports `seeded: true` once pages exist, and
  // uses the founder's authenticated session (cookies shared from the context).
  const status = await page.request.get("/api/cms/seed");
  expect(status.ok()).toBeTruthy();
  const body = (await status.json()) as { seeded?: boolean };
  expect(body.seeded).toBe(true);

  // And assert what sign-up persisted in the DB (service role, see helpers/db):
  // a CONFIRMED auth.users row, mirrored by the signup trigger into
  // public.profiles with the first user auto-flagged is_staff.
  const authUser = await fetchAuthUserByEmail(email);
  if (!authUser) {
    throw new Error(`sign-up left no auth.users row for ${email}`);
  }
  expect(authUser.email_confirmed_at).toBeTruthy();
  const profile = await fetchProfile(authUser.id);
  if (!profile) {
    throw new Error(`signup trigger created no profiles row for ${email}`);
  }
  expect(profile.display_name).toBe("Founder");
  expect(profile.is_staff).toBe(true);

  // Persist the founder session (staff-invite.spec.ts acts as staff) and
  // email (admin-login.spec.ts signs in fresh with it).
  await page.context().storageState({ path: FOUNDER_STORAGE_STATE });
  await writeFile(FOUNDER_META, JSON.stringify({ email }));
});
