import { expect, test } from "@playwright/test";

import { FOUNDER_STORAGE_STATE } from "./helpers/founder";
import { fetchAuthEmail } from "./helpers/mailpit";

/**
 * Staff invite e2e: the founder creates a user in the Payload admin (Users →
 * Create New), which sends a Supabase invite email and flags the invitee as
 * staff (payload/hooks/invite-user.ts). The invitee opens the link
 * (/accept-invite?token_hash=… from the kit's invite template), sets a
 * password, and lands in /admin.
 *
 * Acts as the founder via the session saved by founder.setup.ts. The invite
 * link is opened in a FRESH browser context on purpose: invites must work in a
 * browser that never saw the site (token_hash verification has no PKCE
 * coupling) — this asserts that property. It also exercises why the template
 * links here directly: a first-ever visit makes Chromium restart the
 * navigation for Payload's site-wide Critical-CH client hint, which burns
 * GoTrue's default link-style one-time token (redirect chain re-run) but is
 * harmless for an explicit verifyOtp call from the page.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the web app's .env (the invite hook
 * uses it; CI provisions it).
 */
test.use({ storageState: FOUNDER_STORAGE_STATE });

test("inviting a staff user from /admin → accept invite → /admin", async ({
  page,
  browser,
}) => {
  // Payload's admin UI can be slow to first-compile on a cold dev server.
  test.setTimeout(120_000);

  const email = `invitee-${Date.now()}@test.local`;

  await page.goto("/admin/collections/users/create");
  // Target Payload's stable field ids — the users form now carries the full
  // member profile (Display Name / First Name / …), so label text is ambiguous.
  await page.locator("#field-email").fill(email);
  await page.locator("#field-name").fill("Invited Editor");
  await page.getByRole("button", { name: "Save" }).click();

  // The hook ran iff the doc saved — Payload confirms with a success toast.
  // One retry: local GoTrue under load can 504 mid-invite (the email usually
  // went out anyway); re-saving hits the hook's email_exists → promote path,
  // which is idempotent by design.
  try {
    await expect(page.getByText(/successfully/i)).toBeVisible({
      timeout: 30_000,
    });
  } catch {
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
      timeout: 30_000,
    });
  }

  // The invite email links straight to /accept-invite?token_hash=… (kit
  // template) — no code; only the sign-up confirmation template includes one.
  const { link } = await fetchAuthEmail(email);

  // Fresh context = different "browser" than the founder's. The empty
  // storageState matters: browser.newContext() inherits the test's context
  // options, so without it the invitee would silently carry the FOUNDER's
  // cookies from test.use() above.
  const inviteeContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const inviteePage = await inviteeContext.newPage();
  await inviteePage.goto(link);

  // The page verifies the token_hash (verifyOtp) and shows the password form.
  await inviteePage.waitForURL(/\/accept-invite/);
  await expect(
    inviteePage.getByRole("heading", { name: "You’re invited" }),
  ).toBeVisible({ timeout: 15_000 });
  // Wait for hydration before interacting — a click that fires before React
  // attaches the submit handler silently no-ops (same caveat as critical-path).
  await inviteePage.waitForLoadState("networkidle");

  await inviteePage.getByLabel("Password", { exact: true }).fill("password123");
  await inviteePage.getByLabel("Confirm password").fill("password123");
  await inviteePage.getByRole("button", { name: "Continue" }).click();

  // is_staff was flagged at invite time, so /welcome routes staff to /admin (the
  // gate passes) and the SSO bridge maps the session onto the cms.users row above.
  await inviteePage.waitForURL(/\/admin/, { timeout: 30_000 });

  await inviteeContext.close();
});
