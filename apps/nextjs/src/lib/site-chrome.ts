/**
 * Single source of truth for the public site chrome — the header nav + action
 * buttons and the footer link columns, policy links and social handles.
 *
 * Consumed by BOTH:
 *   - the CMS seed (`payload/seed.ts` → the `site-settings` global), and
 *   - the fallback defaults the header/footer render when the CMS is
 *     unreachable or unseeded (`components/public-header.tsx`,
 *     `components/site-footer.tsx`).
 *
 * Because both paths read from here, the "before seed" (fallback) and "after
 * seed" (CMS) experiences are identical. Edit the chrome HERE once and both stay
 * in sync. The shapes mirror the `site-settings` field schema
 * (`payload/globals/SiteSettings.ts`), so the constants can be handed straight
 * to `payload.updateGlobal`.
 */

export interface ChromeSubLink {
  label: string;
  url: string;
  description?: string;
}

export interface ChromeNavItem {
  label: string;
  url: string;
  submenu?: ChromeSubLink[];
}

/** Mirrors BUTTON_VARIANTS in `payload/blocks/shared.ts`. */
export type ChromeButtonVariant = "default" | "glow" | "outline" | "secondary";

export interface ChromeAction {
  label: string;
  url: string;
  isButton: boolean;
  variant?: ChromeButtonVariant;
}

export interface ChromeFooterLink {
  label: string;
  url: string;
}

export interface ChromeFooterColumn {
  title: string;
  links: ChromeFooterLink[];
}

/** True for absolute http(s) URLs — rendered as new-tab external links. */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export const SITE_HEADER: ChromeNavItem[] = [
  { label: "Features", url: "/features" },
  { label: "Pricing", url: "/pricing" },
  {
    label: "Resources",
    url: "/posts",
    submenu: [
      {
        label: "10,000+ app ideas",
        url: "https://meetdream.com/",
        description: "Vetted, scored startup ideas on Meet Dream.",
      },
      {
        label: "Future.dev",
        url: "https://future.dev/",
        description: "Done-for-you software development.",
      },
      {
        label: "Posts",
        url: "/posts",
        description: "Long-form posts and updates.",
      },
      {
        label: "Events",
        url: "/events",
        description: "Upcoming and past events.",
      },
      { label: "Videos", url: "/videos", description: "Watch and learn." },
      {
        label: "Photos",
        url: "/photos",
        description: "Galleries and imagery.",
      },
    ],
  },
  { label: "About", url: "/about" },
];

export const SITE_HEADER_ACTIONS: ChromeAction[] = [
  { label: "Sign in", url: "/sign-in", isButton: false },
  { label: "Get started", url: "/sign-up", isButton: true, variant: "default" },
];

// Footer columns mirror the header: Product (Features/Pricing), Resources (the
// header's Resources dropdown), and Company.
export const SITE_FOOTER_COLUMNS: ChromeFooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Features", url: "/features" },
      { label: "Pricing", url: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "10,000+ app ideas", url: "https://meetdream.com/" },
      { label: "Future.dev", url: "https://future.dev/" },
      { label: "Posts", url: "/posts" },
      { label: "Events", url: "/events" },
      { label: "Videos", url: "/videos" },
      { label: "Photos", url: "/photos" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", url: "/about" },
      { label: "Contact", url: "/contact" },
    ],
  },
];

export const SITE_FOOTER_POLICIES: ChromeFooterLink[] = [
  { label: "Terms of Service", url: "/terms" },
  { label: "Privacy Policy", url: "/privacy" },
];

export const SITE_SOCIAL = {
  twitter: "dreamstarterkit",
  github: "vytenapps",
};
