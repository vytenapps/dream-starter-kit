import type { MetadataRoute } from "next";

import { listEvents, listLocations, listPosts } from "~/lib/payload";
import { getSiteUrl } from "~/lib/site-url";

/** Public, crawlable routes. Authed (app) routes are excluded (see robots.ts). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/sign-in`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/sign-up`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...(["about", "contact", "terms", "privacy"] as const).map((slug) => ({
      url: `${base}/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  // Append published CMS content. Wrapped so a build without a reachable DB
  // (e.g. placeholder env) still emits the static routes above.
  try {
    const [posts, events, locations] = await Promise.all([
      listPosts(),
      listEvents(),
      listLocations(),
    ]);
    for (const post of posts) {
      entries.push({
        url: `${base}/posts/${post.slug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const event of events) {
      entries.push({
        url: `${base}/events/${event.slug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const location of locations) {
      entries.push({
        url: `${base}/locations/${location.slug}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // CMS not configured/reachable — emit static routes only.
  }

  return entries;
}
