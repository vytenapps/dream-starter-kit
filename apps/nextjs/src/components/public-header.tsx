import type { NavbarActionProps } from "~/components/launch-ui/sections/navbar";
import type { NavItem } from "~/components/launch-ui/ui/navigation";
import LaunchUI from "~/components/launch-ui/logos/launch-ui";
import Navbar from "~/components/launch-ui/sections/navbar";
import { getBranding, getSiteSettings } from "~/lib/payload";

/** Nav shown when the CMS is unreachable (e.g. a placeholder-env build). */
const DEFAULT_NAV: NavItem[] = [
  { title: "Articles", href: "/articles" },
  { title: "Events", href: "/events" },
  { title: "Videos", href: "/videos" },
  { title: "Photos", href: "/photos" },
  { title: "Locations", href: "/locations" },
  { title: "About", href: "/about" },
];

const DEFAULT_ACTIONS: NavbarActionProps[] = [
  { text: "Sign in", href: "/sign-in", isButton: false },
  { text: "Get started", href: "/sign-up", isButton: true, variant: "default" },
];

/**
 * Public site header — the Launch UI Navbar, driven by the SiteSettings global
 * (nav items + optional dropdown sub-menus + right-side actions) and branding
 * (app name/logo from theme-settings). Falls back to sensible defaults when the
 * CMS is unreachable.
 */
export async function PublicHeader() {
  const branding = await getBranding();

  let items = DEFAULT_NAV;
  let actions = DEFAULT_ACTIONS;
  try {
    const settings = await getSiteSettings();
    if (settings.header && settings.header.length > 0) {
      items = settings.header.map((item) => ({
        title: item.label,
        href: item.url,
        submenu:
          item.submenu && item.submenu.length > 0
            ? item.submenu.map((sub) => ({
                title: sub.label,
                href: sub.url,
                description: sub.description ?? undefined,
              }))
            : undefined,
      }));
    }
    if (settings.headerActions && settings.headerActions.length > 0) {
      actions = settings.headerActions.map((action) => ({
        text: action.label,
        href: action.url,
        isButton: action.isButton ?? false,
        variant: action.variant ?? "default",
      }));
    }
  } catch {
    // CMS not configured/reachable — keep the default nav + actions.
  }

  const mobileLinks = items.flatMap((item) => [
    { text: item.title, href: item.href ?? "#" },
    ...(item.submenu ?? []).map((sub) => ({ text: sub.title, href: sub.href })),
  ]);

  const logo = branding.logoLightUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branding.logoLightUrl}
      alt={branding.appName}
      className="h-6 w-auto"
    />
  ) : (
    <LaunchUI className="text-brand size-6" />
  );

  return (
    <Navbar
      logo={logo}
      name={branding.appName}
      homeUrl="/"
      items={items}
      mobileLinks={mobileLinks}
      actions={actions}
    />
  );
}
