/**
 * Payload demo content seed (Local API). Run with `pnpm cms:seed` AFTER
 * `pnpm cms:migrate` has built the `cms` schema. Idempotent: bails if pages
 * already exist. Creates a demo admin + scalar-only content; collections that
 * require an uploaded asset (audio, photos) are left for editors to add via
 * the admin so the seed needs no binary fixtures.
 */
import { getPayload } from "payload";

import config from "../payload.config";

async function seed() {
  const payload = await getPayload({ config });

  const existingPages = await payload.find({ collection: "pages", limit: 0 });
  if (existingPages.totalDocs > 0) {
    payload.logger.info("CMS already seeded — skipping.");
    return;
  }

  const users = await payload.find({ collection: "users", limit: 0 });
  if (users.totalDocs === 0) {
    await payload.create({
      collection: "users",
      data: {
        email: "editor@example.com",
        password: "password123",
        name: "Demo Editor",
        role: "admin",
      },
    });
    payload.logger.info("Created demo admin: editor@example.com / password123");
  }

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

  await payload.create({
    collection: "articles",
    data: {
      title: "Welcome to the kit",
      slug: "welcome-to-the-kit",
      excerpt: "Your content-driven starter is ready to extend.",
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
      publishedAt: "2026-01-02T00:00:00.000Z",
      _status: "published",
    },
  });

  await payload.create({
    collection: "locations",
    data: {
      name: "Demo HQ",
      slug: "demo-hq",
      address: "123 Demo St",
      _status: "published",
    },
  });
  await payload.create({
    collection: "events",
    data: {
      title: "Launch day",
      slug: "launch-day",
      startsAt: "2026-02-01T18:00:00.000Z",
      _status: "published",
    },
  });
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

  payload.logger.info("CMS seed complete.");
}

void seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
