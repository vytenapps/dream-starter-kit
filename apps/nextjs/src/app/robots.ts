import type { MetadataRoute } from "next";

import { getSiteUrl } from "~/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authed app surfaces + API routes out of the index.
      disallow: [
        "/api/",
        "/dashboard",
        "/projects",
        "/chat",
        "/profile",
        "/reminders",
        "/notifications",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
