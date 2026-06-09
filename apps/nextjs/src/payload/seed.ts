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
              { label: "Home", url: "/" },
              { label: "Articles", url: "/articles" },
              { label: "Events", url: "/events" },
              { label: "About", url: "/about" },
            ],
            footer: [
              { label: "Terms", url: "/terms" },
              { label: "Privacy", url: "/privacy" },
              { label: "Contact", url: "/contact" },
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
