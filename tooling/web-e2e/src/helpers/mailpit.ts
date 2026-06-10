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
 * the action link (a Supabase `/auth/v1/verify` link in confirmation emails, or
 * the app's `/accept-invite?token_hash=…` link in invite emails) and, when
 * present, the 6-digit OTP code from the customized confirmation template.
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
    /https?:\/\/[^\s"'<>]*(?:\/auth\/v1\/verify|\/accept-invite\?token_hash=)[^\s"'<>]*/;
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
 * Sign up through the UI and complete email confirmation by following the
 * emailed link. Email confirmations are ON locally (matching hosted Supabase),
 * so submitting the form lands on /check-email, not the app.
 *
 * The link is opened in the SAME page: the confirmation link is PKCE-coupled
 * (the code verifier cookie was set at sign-up), so it only completes in the
 * browser context that signed up. It ends on /auth/callback → /welcome, which
 * routes the founder to /cms-setup and everyone else to /dashboard — assert
 * the destination in the caller.
 */
export async function signUpAndConfirm(
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

  await page.waitForURL(/\/check-email/);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  const { link } = await fetchAuthEmail(email);
  await page.goto(link);
}
