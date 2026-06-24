import { expect, request, test } from "@playwright/test";

import {
  fetchAuthUser,
  fetchAuthUserByEmail,
  fetchContentFavorites,
  grantActiveSubscription,
} from "./helpers/db";
import { FOUNDER_STORAGE_STATE } from "./helpers/founder";
import { signUpAndConfirm } from "./helpers/mailpit";

/**
 * Anonymous-first identity + premium-content paywall.
 *
 * Covers the ported feature end-to-end against the LOCAL stack:
 *   - favoriting as a logged-out visitor mints a real anonymous account
 *     (public.content_favorites is the one table anon users may write);
 *   - a premium post is gated (blurred body + on-page paywall dock);
 *   - the billing express-intent route (the embedded paywall's backend) creates
 *     a real Stripe subscription intent — a "paid signup" against Stripe test
 *     mode (requires a sk_test key; skipped otherwise);
 *   - a free user "upgrading to paid" (an active subscription appears) unlocks
 *     the premium body — the usePremium gating flip.
 *
 * The full embedded Apple/Google-Pay + card payment runs through Stripe's
 * cross-origin payment iframe; that last mile is covered by the manual
 * verification steps in the PR rather than a brittle CI iframe-driver.
 *
 * Turnstile: the suite runs with Supabase CAPTCHA OFF (config.toml leaves
 * [auth.captcha] commented), so anon sign-in needs no token. With CAPTCHA on,
 * use Cloudflare's always-pass test keys (site 1x00000000000000000000AA /
 * secret 1x0000000000000000000000000000000AA) — see docs/TURNSTILE.md.
 */

const BASE_URL = "http://localhost:3000";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

function uniqueEmail() {
  return `paywall-e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

interface PostDoc {
  id: number | string;
  slug: string;
  title: string;
}

/** Fetch the first published post (public CMS read) for the favorite test. */
async function firstPublishedPost(): Promise<PostDoc> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.get(
    "/cms-api/posts?where[_status][equals]=published&limit=1&depth=0",
  );
  const json = (await res.json()) as { docs: PostDoc[] };
  const doc = json.docs[0];
  if (!doc) throw new Error("no published post seeded");
  return doc;
}

/**
 * Ensure a published PREMIUM post exists (staff create via the CMS API) and
 * return it. Idempotent across runs via a stable slug.
 */
async function ensurePremiumPost(): Promise<PostDoc> {
  const slug = "e2e-premium-post";
  const staff = await request.newContext({
    baseURL: BASE_URL,
    storageState: FOUNDER_STORAGE_STATE,
  });
  const existing = await staff.get(
    `/cms-api/posts?where[slug][equals]=${slug}&limit=1&depth=0`,
  );
  const found = (await existing.json()) as { docs: PostDoc[] };
  if (found.docs[0]) return found.docs[0];

  const created = await staff.post("/cms-api/posts", {
    data: {
      title: "E2E Premium Post",
      slug,
      accessLevel: "premium",
      _status: "published",
      excerpt: "A gated post for the paywall e2e.",
      body: {
        root: {
          type: "root",
          direction: null,
          format: "",
          indent: 0,
          version: 1,
          children: [
            {
              type: "paragraph",
              direction: null,
              format: "",
              indent: 0,
              version: 1,
              children: [
                {
                  type: "text",
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: "SECRET-PREMIUM-BODY for the e2e gating assertion.",
                  version: 1,
                },
              ],
            },
          ],
        },
      },
    },
  });
  if (!created.ok()) {
    throw new Error(`premium post create failed: ${created.status()}`);
  }
  const doc = (await created.json()) as { doc: PostDoc };
  return doc.doc;
}

/** Sync the seeded monthly plan to Stripe so it has a stripePriceId. */
async function ensureMonthlyPlanSynced(): Promise<string | number> {
  const staff = await request.newContext({
    baseURL: BASE_URL,
    storageState: FOUNDER_STORAGE_STATE,
  });
  const list = await staff.get(
    "/cms-api/ext-billing-plans?where[slug][equals]=dream-monthly&depth=0",
  );
  const { docs } = (await list.json()) as {
    docs: { id: string | number; stripePriceId?: string }[];
  };
  const plan = docs[0];
  if (!plan) throw new Error("dream-monthly plan not seeded");
  if (!plan.stripePriceId) {
    await staff.patch(`/cms-api/ext-billing-plans/${plan.id}`, { data: {} });
    await expect
      .poll(
        async () => {
          const res = await staff.get(
            `/cms-api/ext-billing-plans/${plan.id}?depth=0`,
          );
          const doc = (await res.json()) as {
            stripePriceId?: string;
            syncStatus?: string;
            syncError?: string;
          };
          if (doc.syncStatus === "error") {
            throw new Error(`Stripe sync failed: ${doc.syncError}`);
          }
          return doc.stripePriceId ?? null;
        },
        { timeout: 30_000 },
      )
      .not.toBeNull();
  }
  return plan.id;
}

test("favoriting a post as a logged-out visitor mints an anonymous account", async ({
  page,
}) => {
  const post = await firstPublishedPost();
  await page.goto(`/posts/${post.slug}`);

  await page.getByRole("button", { name: /save/i }).first().click();

  // The save writes public.content_favorites under a freshly-minted anonymous
  // auth user (ensureAnonSession). Poll for the row, then assert its owner is
  // an anonymous user.
  let ownerId = "";
  await expect
    .poll(
      async () => {
        const rows = await fetchContentFavorites(
          `collection=eq.posts&item_id=eq.${post.id}&select=user_id,collection,item_id`,
        );
        ownerId = rows[0]?.user_id ?? "";
        return rows.length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  const owner = await fetchAuthUser(ownerId);
  expect(owner?.is_anonymous).toBe(true);
});

test("a premium post is gated for non-premium visitors", async ({ page }) => {
  const post = await ensurePremiumPost();
  await page.goto(`/posts/${post.slug}`);

  // The on-page dock (the offer) is shown and the body is behind the gate.
  await expect(page.locator(".premium-gate")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /pay with credit card/i }),
  ).toBeVisible();
});

test("a user with an active subscription sees the premium body (gating flip)", async ({
  page,
}) => {
  const post = await ensurePremiumPost();
  const email = uniqueEmail();
  await signUpAndConfirm(page, { name: "Paywall E2E", email });

  // While free, the premium post is gated.
  await page.goto(`/posts/${post.slug}`);
  await expect(page.locator(".premium-gate")).toBeVisible();

  // "Upgrade to paid": grant an active subscription (webhook-style write), then
  // the usePremium query unlocks the content on reload.
  const user = await fetchAuthUserByEmail(email);
  if (!user) throw new Error("confirmed user not found");
  await grantActiveSubscription(user.id);

  await page.goto(`/posts/${post.slug}`);
  await expect(page.getByText(/SECRET-PREMIUM-BODY/)).toBeVisible();
  await expect(page.locator(".premium-gate")).toHaveCount(0);
});

test("the billing express-intent route creates a Stripe subscription intent (paid signup backend)", async () => {
  test.skip(
    !STRIPE_KEY?.startsWith("sk_test"),
    "needs a Stripe test key (STRIPE_SECRET_KEY=sk_test_…)",
  );
  test.setTimeout(60_000);
  const planId = await ensureMonthlyPlanSynced();

  // A guest (no session) hits the embedded paywall's backend directly. Signed-in
  // / anonymous buyers additionally get supabase_user_id stamped (covered by the
  // unit + RLS suites); here we assert the route returns a usable client secret.
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/ext/billing/express-intent", {
    data: { planId },
  });
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { clientSecret?: string; mode?: string };
  expect(json.clientSecret).toBeTruthy();
  expect(["payment", "setup"]).toContain(json.mode);
});
