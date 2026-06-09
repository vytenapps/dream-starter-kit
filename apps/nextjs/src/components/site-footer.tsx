import type { FooterColumnProps } from "~/components/launch-ui/sections/footer";
import LaunchUI from "~/components/launch-ui/logos/launch-ui";
import FooterSection from "~/components/launch-ui/sections/footer";
import { getBranding, getSiteSettings } from "~/lib/payload";

const DEFAULT_COLUMNS: FooterColumnProps[] = [
  {
    title: "Content",
    links: [
      { text: "Articles", href: "/articles" },
      { text: "Events", href: "/events" },
      { text: "Videos", href: "/videos" },
    ],
  },
  {
    title: "Company",
    links: [
      { text: "About", href: "/about" },
      { text: "Contact", href: "/contact" },
    ],
  },
];

const DEFAULT_POLICIES = [
  { text: "Terms", href: "/terms" },
  { text: "Privacy", href: "/privacy" },
];

/**
 * Public site footer — the Launch UI Footer, driven by the SiteSettings global
 * (link columns + bottom-bar policy links + copyright) and branding (app name
 * from theme-settings). Falls back to sensible defaults when the CMS is
 * unreachable.
 */
export async function SiteFooter() {
  const branding = await getBranding();

  let columns = DEFAULT_COLUMNS;
  let policies = DEFAULT_POLICIES;
  let copyright: string | undefined;
  try {
    const settings = await getSiteSettings();
    if (settings.footerColumns && settings.footerColumns.length > 0) {
      columns = settings.footerColumns.map((column) => ({
        title: column.title,
        links: (column.links ?? []).map((link) => ({
          text: link.label,
          href: link.url,
        })),
      }));
    }
    if (settings.footerPolicies && settings.footerPolicies.length > 0) {
      policies = settings.footerPolicies.map((policy) => ({
        text: policy.label,
        href: policy.url,
      }));
    }
    copyright = settings.copyright ?? undefined;
  } catch {
    // CMS not configured/reachable — keep the default columns + policies.
  }

  return (
    <FooterSection
      logo={<LaunchUI className="text-brand size-6" />}
      name={branding.appName}
      columns={columns}
      policies={policies}
      copyright={copyright}
    />
  );
}
