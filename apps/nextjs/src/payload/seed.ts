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
        for (const page of [
          { title: "Home", slug: "home" },
          { title: "About", slug: "about" },
          { title: "Contact", slug: "contact" },
          { title: "Terms of Service", slug: "terms" },
          { title: "Privacy Policy", slug: "privacy" },
        ]) {
          await payload.create({
            collection: "pages",
            data: { ...page, _status: "published" },
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
            excerpt: "Articles, events, media and more — all in the cms schema.",
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
