import Link from "next/link";

import { APP_NAME } from "@acme/config/constants";

import { getSiteSettings } from "~/lib/payload";

const DEFAULT_NAV = [
  { label: "Articles", url: "/articles" },
  { label: "Events", url: "/events" },
  { label: "Videos", url: "/videos" },
  { label: "Photos", url: "/photos" },
  { label: "Locations", url: "/locations" },
  { label: "About", url: "/about" },
];

/** Public site header. Nav comes from the SiteSettings global, with a sensible
 *  default if the CMS is unreachable (e.g. a placeholder-env build). */
export async function PublicHeader() {
  let nav = DEFAULT_NAV;
  try {
    const settings = await getSiteSettings();
    if (settings.header && settings.header.length > 0) {
      nav = settings.header.map((item) => ({
        label: item.label,
        url: item.url,
      }));
    }
  } catch {
    // CMS not configured/reachable — fall back to the default nav.
  }

  return (
    <header className="border-b">
      <nav className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold">
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {nav.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className="text-muted-foreground hover:text-foreground hidden sm:inline"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/sign-in" className="font-medium">
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
