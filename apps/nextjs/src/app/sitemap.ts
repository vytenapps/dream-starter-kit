import type { MetadataRoute } from "next";

import { getSiteUrl } from "~/lib/site-url";

/** Public, crawlable routes. Authed (app) routes are excluded (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();
  return [
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
  ];
}
