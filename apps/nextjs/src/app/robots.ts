import type { MetadataRoute } from "next";

import { getSiteUrl } from "~/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authed app surfaces, the CMS admin, and API routes out of the index.
      disallow: [
        "/api/",
        "/cms-api/",
        "/admin",
        "/a",
        "/chat",
        "/profile",
        "/reminders",
        "/notifications",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
