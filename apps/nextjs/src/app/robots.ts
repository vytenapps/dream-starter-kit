import type { MetadataRoute } from "next";

import { env } from "~/env";

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
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
