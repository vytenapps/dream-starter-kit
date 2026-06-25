import type { NavbarActionProps } from "~/components/launch-ui/sections/navbar";
import type { NavItem } from "~/components/launch-ui/ui/navigation";
import Navbar from "~/components/launch-ui/sections/navbar";
import { PublicHeaderUser } from "~/components/public-header-user";
import { getBranding, getSiteSettings } from "~/lib/payload";
import { SITE_HEADER, SITE_HEADER_ACTIONS } from "~/lib/site-chrome";

// Nav + actions shown before/without the CMS (placeholder-env build, unseeded
// DB). Derived from the shared site-chrome source so they match what the seed
// writes into the CMS — the menu is identical before and after seeding.
const DEFAULT_NAV: NavItem[] = SITE_HEADER.map((item) => ({
  title: item.label,
  href: item.url,
  submenu: item.submenu?.map((sub) => ({
    title: sub.label,
    href: sub.url,
    description: sub.description,
  })),
}));

const DEFAULT_ACTIONS: NavbarActionProps[] = SITE_HEADER_ACTIONS.map(
  (action) => ({
    text: action.label,
    href: action.url,
    isButton: action.isButton,
    variant: action.variant ?? "default",
  }),
);

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
    // Brand mark from the favicon set (auto light/dark via favicon.svg's own
    // prefers-color-scheme styles). Decorative — the adjacent app name labels it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/favicon.svg" alt="" aria-hidden className="size-6" />
  );

  return (
    <Navbar
      logo={logo}
      name={branding.appName}
      homeUrl={branding.brandLink.url}
      homeNewTab={branding.brandLink.newTab}
      items={items}
      mobileLinks={mobileLinks}
      actions={actions}
      // Auth-aware right side: the configured actions (Sign in / CTA) for
      // logged-out visitors, the shared account avatar dropdown once signed in.
      actionsSlot={<PublicHeaderUser actions={actions} />}
    />
  );
}
