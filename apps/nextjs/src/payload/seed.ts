/**
 * Payload demo content seed (Local API). Idempotent: bails if pages already
 * exist. Creates scalar-only content; collections that require an uploaded
 * asset (audio, photos) are left for editors to add via the admin so the seed
 * needs no binary fixtures.
 *
 * Two entry points share `seedCmsContent`:
 *   - the CLI (`pnpm cms:seed`) — runs after `pnpm cms:migrate` builds the `cms`
 *     schema; creates a demo admin if none exists. Used for headless/CI setup.
 *   - the first-admin onboarding flow (`/api/cms/seed` → `/cms-setup`) — runs
 *     automatically when the first Payload admin is created, reporting progress.
 */
import type { Payload } from "payload";
import { getPayload } from "payload";

import config from "../payload.config";

/** Reports seed progress: `done`/`total` steps complete, with the step label. */
export type SeedProgress = (done: number, total: number, label: string) => void;

/** Build a minimal Lexical rich-text value from plain paragraphs (for prose). */
function richText(paragraphs: string[]) {
  return {
    root: {
      type: "root",
      format: "" as const,
      indent: 0,
      version: 1,
      direction: "ltr" as const,
      children: paragraphs.map((text) => ({
        type: "paragraph",
        format: "" as const,
        indent: 0,
        version: 1,
        direction: "ltr" as const,
        children: [
          {
            type: "text",
            text,
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
            version: 1,
          },
        ],
      })),
    },
  };
}

/**
 * Seed demo CMS content. Idempotent — returns `{ seeded: false }` without
 * changes if pages already exist. Assigns the first existing admin as article
 * author when present; only creates the demo `editor@example.com` admin when no
 * users exist at all (the CLI path).
 */
export async function seedCmsContent(
  payload: Payload,
  onProgress?: SeedProgress,
): Promise<{ seeded: boolean }> {
  const existingPages = await payload.find({ collection: "pages", limit: 0 });
  if (existingPages.totalDocs > 0) {
    payload.logger.info("CMS already seeded — skipping.");
    return { seeded: false };
  }

  // Use the first existing admin (e.g. the just-created first user) as author;
  // otherwise create a placeholder author. Auth is SSO-only (no Payload password):
  // real editors are provisioned from their Supabase session by the auth bridge, so
  // this demo row exists only as an article author for the CLI/headless path.
  const users = await payload.find({ collection: "users", limit: 1 });
  let authorId = users.docs[0]?.id;
  if (!authorId) {
    const demo = await payload.create({
      collection: "users",
      data: {
        email: "editor@example.com",
        name: "Demo Editor",
        role: "admin",
      },
    });
    authorId = demo.id;
    payload.logger.info("Created placeholder author: editor@example.com");
  }

  // Ordered steps; progress is reported after each completes.
  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: "Site settings",
      run: async () => {
        await payload.updateGlobal({
          slug: "site-settings",
          data: {
            header: [
              {
                label: "Content",
                url: "/articles",
                submenu: [
                  {
                    label: "Articles",
                    url: "/articles",
                    description: "Long-form posts and updates.",
                  },
                  {
                    label: "Events",
                    url: "/events",
                    description: "Upcoming and past events.",
                  },
                  {
                    label: "Videos",
                    url: "/videos",
                    description: "Watch and learn.",
                  },
                  {
                    label: "Photos",
                    url: "/photos",
                    description: "Galleries and imagery.",
                  },
                ],
              },
              { label: "Locations", url: "/locations" },
              { label: "Pricing", url: "/pricing" },
              { label: "About", url: "/about" },
            ],
            headerActions: [
              { label: "Sign in", url: "/sign-in", isButton: false },
              {
                label: "Get started",
                url: "/sign-up",
                isButton: true,
                variant: "default",
              },
            ],
            footerColumns: [
              {
                title: "Content",
                links: [
                  { label: "Articles", url: "/articles" },
                  { label: "Events", url: "/events" },
                  { label: "Videos", url: "/videos" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About", url: "/about" },
                  { label: "Contact", url: "/contact" },
                ],
              },
            ],
            footerPolicies: [
              { label: "Terms", url: "/terms" },
              { label: "Privacy", url: "/privacy" },
            ],
            social: { twitter: "dreamstarterkit", github: "vytenapps" },
          },
        });
      },
    },
    {
      label: "Pages",
      run: async () => {
        // Home: a full Launch UI marketing layout (hero → features → stats →
        // CTA → FAQ) so a fresh clone shows the design out of the box.
        await payload.create({
          collection: "pages",
          data: {
            title: "Home",
            slug: "home",
            _status: "published",
            layout: [
              {
                blockType: "hero",
                title: "Give your idea the app it deserves",
                description:
                  "A clone-and-ship starter: a Next.js web app and an Expo mobile app sharing one Supabase backend — auth, payments, AI and content built in.",
                badgeText: "Open source",
                badgeLinkText: "Get started",
                badgeLinkHref: "/sign-in",
                buttons: [
                  { text: "Get started", href: "/sign-in", variant: "default" },
                  { text: "Read articles", href: "/articles", variant: "glow" },
                ],
              },
              {
                blockType: "items",
                title: "Everything you need. Nothing you don't.",
                items: [
                  {
                    title: "One backend",
                    description:
                      "Web and mobile share a single Supabase backend.",
                    icon: "Layers",
                  },
                  {
                    title: "Secure by default",
                    description: "Row-Level Security on every table.",
                    icon: "ShieldCheck",
                  },
                  {
                    title: "AI built in",
                    description: "A streaming AI assistant, ready to extend.",
                    icon: "Sparkles",
                  },
                  {
                    title: "Ships fast",
                    description:
                      "Auth, billing and push notifications included.",
                    icon: "Rocket",
                  },
                ],
              },
              {
                blockType: "stats",
                items: [
                  {
                    label: "ships",
                    value: "2",
                    suffix: "x",
                    description: "web + native apps",
                  },
                  {
                    value: "100",
                    suffix: "%",
                    description: "TypeScript, end to end",
                  },
                  {
                    label: "includes",
                    value: "8",
                    description: "Launch UI sections",
                  },
                  {
                    label: "backend",
                    value: "1",
                    description: "Supabase, shared",
                  },
                ],
              },
              {
                blockType: "cta",
                title: "Start building today",
                buttons: [
                  { text: "Get started", href: "/sign-in", variant: "default" },
                ],
              },
              {
                blockType: "faq",
                title: "Questions and answers",
                items: [
                  {
                    question: "What's included?",
                    answer:
                      "Auth, billing, an AI assistant, push notifications and a Payload CMS — all wired up and tested.",
                  },
                  {
                    question: "Can I use it for mobile too?",
                    answer:
                      "Yes — the Expo app shares the same backend, types and feature hooks as the web app.",
                  },
                ],
              },
            ],
          },
        });

        // Text/legal pages render through a single prose block.
        const prose = [
          {
            title: "About",
            slug: "about",
            heading: "About this project",
            body: [
              "This is the Dream Starter Kit — a clone-and-ship foundation for building web and mobile products on one backend.",
              "Edit this page from the Payload admin: add hero, feature, stats, CTA, FAQ or prose sections.",
            ],
          },
          {
            title: "Contact",
            slug: "contact",
            heading: "Get in touch",
            body: [
              "Questions or feedback? Reach out and we'll get back to you.",
            ],
          },
          {
            title: "Terms of Service",
            slug: "terms",
            heading: "Terms of Service",
            body: [
              "These are placeholder terms. Replace this content with your own from the admin.",
            ],
          },
          {
            title: "Privacy Policy",
            slug: "privacy",
            heading: "Privacy Policy",
            body: [
              "This is a placeholder privacy policy. Replace this content with your own from the admin.",
            ],
          },
        ];
        for (const page of prose) {
          await payload.create({
            collection: "pages",
            data: {
              title: page.title,
              slug: page.slug,
              _status: "published",
              layout: [
                {
                  blockType: "prose",
                  title: page.heading,
                  content: richText(page.body),
                },
              ],
            },
          });
        }
      },
    },
    {
      label: "Articles",
      run: async () => {
        await payload.create({
          collection: "articles",
          data: {
            title: "Welcome to the kit",
            slug: "welcome-to-the-kit",
            excerpt: "Your content-driven starter is ready to extend.",
            body: richText([
              "Welcome to the Dream Starter Kit. This article is demo content seeded into the Payload CMS so the blog renders end to end on a fresh clone.",
              "Edit or delete it from the admin at /admin, then publish your own posts. Articles support a hero image, an excerpt and this rich-text body.",
            ]),
            author: authorId,
            publishedAt: "2026-01-01T00:00:00.000Z",
            _status: "published",
          },
        });
        await payload.create({
          collection: "articles",
          data: {
            title: "Modeling content in Payload",
            slug: "modeling-content-in-payload",
            excerpt:
              "Articles, events, media and more — all in the cms schema.",
            body: richText([
              "Payload CMS owns the cms Postgres schema and powers every editorial collection in this kit: articles, events, videos, photos, audio and locations.",
              "Each collection is a thin config file under src/payload/collections. Add a field, run pnpm cms:gen-types, and it flows straight through to the typed web and mobile screens.",
            ]),
            author: authorId,
            publishedAt: "2026-01-02T00:00:00.000Z",
            _status: "published",
          },
        });
      },
    },
    {
      label: "Location",
      run: async () => {
        await payload.create({
          collection: "locations",
          data: {
            name: "Demo HQ",
            slug: "demo-hq",
            address: "123 Demo St",
            description: richText([
              "Demo HQ is a sample location record. Locations pair an address with a rich-text description — use them for stores, venues or offices.",
              "Replace this with your own places from the admin, or delete the locations collection if your product doesn't need it.",
            ]),
            _status: "published",
          },
        });
      },
    },
    {
      label: "Event",
      run: async () => {
        await payload.create({
          collection: "events",
          data: {
            title: "Launch day",
            slug: "launch-day",
            startsAt: "2026-02-01T18:00:00.000Z",
            description: richText([
              "Launch day is a demo event. Events carry a start time and a rich-text description for the agenda, location and details.",
              "This one is seeded so the events list and detail pages render out of the box — edit or remove it from the admin.",
            ]),
            _status: "published",
          },
        });
      },
    },
    {
      label: "Video",
      run: async () => {
        await payload.create({
          collection: "videos",
          data: {
            title: "Intro video",
            slug: "intro-video",
            sourceType: "url",
            url: "https://example.com/intro.mp4",
            _status: "published",
          },
        });
      },
    },
    {
      // Default billing catalog (Payload only — pushed to Stripe later via the
      // per-row "Sync to Stripe" button). Three live plans + one inactive demo
      // showing an introductory offer, plus a welcome coupon for signup codes,
      // and the pricing-page settings that feature the three live plans.
      label: "Plans & pricing",
      run: async () => {
        const monthly = await payload.create({
          collection: "plans",
          data: {
            name: "Dream Monthly Plan",
            slug: "dream-monthly",
            description: "Full access, billed monthly.",
            pricingType: "recurring",
            interval: "month",
            unitAmount: 999,
            currency: "usd",
            displayOrder: 1,
            features: [
              { text: "Everything in Free" },
              { text: "Unlimited AI chat" },
              { text: "Priority support" },
            ],
          },
        });
        const annual = await payload.create({
          collection: "plans",
          data: {
            name: "Dream Annual Plan",
            slug: "dream-annual",
            description:
              "Full access, billed yearly. Includes a 7-day free trial.",
            pricingType: "recurring",
            interval: "year",
            unitAmount: 9999,
            currency: "usd",
            trialDays: 7,
            badge: "Best value",
            highlighted: true,
            displayOrder: 2,
            features: [
              { text: "Everything in Monthly" },
              { text: "7-day free trial" },
              { text: "2 months free vs monthly" },
            ],
          },
        });
        const lifetime = await payload.create({
          collection: "plans",
          data: {
            name: "Dream Lifetime Plan",
            slug: "dream-lifetime",
            description: "One payment, lifetime access.",
            pricingType: "one_time",
            unitAmount: 39900,
            currency: "usd",
            displayOrder: 3,
            features: [
              { text: "Everything in Annual" },
              { text: "Pay once, own forever" },
              { text: "All future updates" },
            ],
          },
        });
        // Inactive demo of an introductory offer ($1.99 first month → $39.99/mo)
        // so the capability is visible out of the box without affecting pricing.
        await payload.create({
          collection: "plans",
          data: {
            name: "Dream Pro (intro demo)",
            slug: "dream-pro-intro-demo",
            description: "$1.99 for the first month, then $39.99/month.",
            pricingType: "recurring",
            interval: "month",
            unitAmount: 3999,
            currency: "usd",
            active: false,
            displayOrder: 99,
            introOffer: { enabled: true, introAmount: 199 },
            features: [{ text: "Example intro pricing" }],
          },
        });

        // Welcome coupon — the signup flow mints a unique, expiring promotion
        // code for this coupon per new free account.
        await payload.create({
          collection: "coupons",
          data: {
            name: "Welcome offer",
            discountType: "percent_off",
            value: 20,
            duration: "once",
            isWelcomeOffer: true,
          },
        });

        await payload.updateGlobal({
          slug: "pricing-settings",
          data: {
            heading: "Pricing",
            subheading: "Start free. Upgrade when you're ready.",
            showFreeTier: true,
            featuredPlans: [monthly.id, annual.id, lifetime.id],
            freeTier: {
              name: "Free",
              description: "Everything you need to get started.",
              ctaLabel: "Get started",
              features: [
                { text: "Core features" },
                { text: "Community support" },
              ],
            },
          },
        });
      },
    },
  ];

  const total = steps.length;
  for (const [i, step] of steps.entries()) {
    await step.run();
    onProgress?.(i + 1, total, step.label);
  }

  payload.logger.info("CMS seed complete.");
  return { seeded: true };
}

/** CLI entry point: `pnpm cms:seed`. */
async function main() {
  const payload = await getPayload({ config });
  await seedCmsContent(payload);
}

// Only run as a script when invoked directly (not when imported by the API
// route). `tsx src/payload/seed.ts` sets import.meta.url to this file.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  void main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
