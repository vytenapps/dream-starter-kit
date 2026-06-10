import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helpers for the email-confirmation flows. Local Supabase delivers all auth
 * email to Mailpit (bundled with `supabase start`; web UI + REST API on the
 * `[inbucket]` port in supabase/config.toml).
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSearchResult {
  messages: { ID: string }[];
}
interface MailpitMessage {
  Text: string;
  HTML: string;
}

/**
 * Poll Mailpit for the newest message to `email` and return its auth content:
 * the action link (the app's `/confirm-email?token_hash=…` /
 * `/accept-invite?token_hash=…` links from the kit templates, or a Supabase
 * `/auth/v1/verify` link from default templates) and, when present, the
 * 6-digit OTP code from the customized confirmation template.
 */
export async function fetchAuthEmail(
  email: string,
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<{ link: string; code: string | null }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    if (search.ok) {
      // Mailpit returns newest-first.
      const { messages } = (await search.json()) as MailpitSearchResult;
      const id = messages[0]?.ID;
      if (id) {
        const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
        if (!res.ok) {
          throw new Error(`Mailpit message fetch failed: ${res.status}`);
        }
        const message = (await res.json()) as MailpitMessage;
        return parseAuthEmail(message, email);
      }
    }
    if (Date.now() > deadline) {
      throw new Error(
        `No email for ${email} arrived in Mailpit (${MAILPIT_URL}) within ${timeoutMs}ms. Is \`supabase start\` running with email confirmations on?`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function parseAuthEmail(
  message: MailpitMessage,
  email: string,
): { link: string; code: string | null } {
  const actionUrl =
    /https?:\/\/[^\s"'<>]*(?:\/auth\/v1\/verify|\/(?:accept-invite|confirm-email)\?token_hash=)[^\s"'<>]*/;
  // Prefer the plain-text body; fall back to HTML (with entities unescaped).
  const link =
    actionUrl.exec(message.Text)?.[0] ??
    actionUrl.exec(message.HTML.replaceAll("&amp;", "&"))?.[0];
  if (!link) {
    throw new Error(`Email to ${email} contains no auth action link.`);
  }
  const code = /\b\d{6}\b/.exec(message.Text)?.[0] ?? null;
  return { link, code };
}

const DEFAULT_PASSWORD = "password123";

/**
 * Sign up through the UI, ending on the /check-email screen. Email
 * confirmations are ON locally (matching hosted Supabase), so submitting the
 * form routes there instead of into the app.
 *
 * Resilience: under local load (next dev compile storms starving Docker),
 * GoTrue can blow its 10s gateway deadline and answer 504 — even though the
 * user WAS created and the confirmation email sent. The form then stays on
 * /sign-up showing an error toast. Rather than fail on infra slowness, fall
 * through to /check-email ourselves; the Mailpit fetch that follows still
 * fails loudly if no email ever arrived (a real signup failure).
 */
export async function signUpToCheckEmail(
  page: Page,
  {
    name,
    email,
    password = DEFAULT_PASSWORD,
  }: { name: string; email: string; password?: string },
): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await page.waitForURL(/\/check-email/, { timeout: 20_000 }).catch(() =>
    // Signup response lost (e.g. GoTrue 504) — the account usually exists
    // anyway; continue on /check-email and let the email fetch decide.
    page.goto(`/check-email?email=${encodeURIComponent(email)}`),
  );
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
}

/**
 * Sign up through the UI and complete email confirmation by following the
 * emailed link from Mailpit (/confirm-email?token_hash=… — verified by the
 * page via verifyOtp, no PKCE coupling). It ends on /welcome, which routes
 * the founder to /cms-setup and everyone else to /dashboard — assert the
 * destination in the caller.
 */
export async function signUpAndConfirm(
  page: Page,
  opts: { name: string; email: string; password?: string },
): Promise<void> {
  await signUpToCheckEmail(page, opts);
  const { link } = await fetchAuthEmail(opts.email);
  await page.goto(link);
  // /confirm-email verifies the token client-side, then hard-navigates through
  // /welcome to the destination — wait out both hops (slow on a loaded dev
  // server) so callers can assert the final URL directly.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith("/confirm-email") &&
      !url.pathname.startsWith("/welcome"),
    { timeout: 60_000 },
  );
}
