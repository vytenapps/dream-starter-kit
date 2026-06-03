import type { MetadataRoute } from "next";

import { env } from "~/env";
import { listArticles, listEvents, listLocations } from "~/lib/payload";

/** Public, crawlable routes. Authed (app) routes are excluded (see robots.ts). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;
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
    const [articles, events, locations] = await Promise.all([
      listArticles(),
      listEvents(),
      listLocations(),
    ]);
    for (const article of articles) {
      entries.push({
        url: `${base}/articles/${article.slug}`,
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
