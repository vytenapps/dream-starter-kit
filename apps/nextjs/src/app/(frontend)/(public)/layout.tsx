import type { ReactNode } from "react";

import { PublicHeader } from "~/components/public-header";
import { SiteFooter } from "~/components/site-footer";

/**
 * Public marketing/content chrome (header + footer), wrapping the Payload-backed
 * pages: home, about/contact/terms/privacy, posts, events, videos, audio,
 * photos, locations. Auth and the signed-in app live in sibling route groups
 * with their own layouts.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
