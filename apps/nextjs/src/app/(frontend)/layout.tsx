import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lora,
  Merriweather,
} from "next/font/google";

import { cn } from "@acme/ui";
import { ThemeProvider, themeDetectorScript } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { Providers } from "~/app/providers";
import { ThemeStyle } from "~/components/theme-style";
import { getBranding } from "~/lib/payload";
import { getSiteUrl } from "~/lib/site-url";

import "~/app/styles.css";

const description =
  "Universal web + mobile starter — Next.js & Expo on one Supabase backend, with Row-Level Security, Stripe billing and AI built in.";

const siteUrl = getSiteUrl();

/**
 * Metadata is branding-aware: the app name + favicon come from the
 * `theme-settings` CMS global (with the kit's defaults as fallback), so a cloner
 * rebrands the title/icon from `/admin/theme` without touching code.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { appName, appIconUrl } = await getBranding();
  // Static favicon set (RealFaviconGenerator output, in /public) used by default.
  // When a CMS branding `appIcon` is uploaded it overrides the head <link> icons,
  // so a cloner can rebrand from /admin/theme without touching code — the static
  // PNGs/manifest stay as the baseline (Android PWA, legacy shortcut).
  const icons: Metadata["icons"] = appIconUrl
    ? { icon: appIconUrl, apple: appIconUrl }
    : {
        icon: [
          { url: "/favicon.ico", sizes: "any" },
          { url: "/favicon.svg", type: "image/svg+xml" },
          { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
        ],
        shortcut: "/favicon.ico",
        apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
      };
  return {
    metadataBase: new URL(siteUrl),
    title: { default: appName, template: `%s · ${appName}` },
    applicationName: appName,
    description,
    keywords: [
      "Next.js",
      "Expo",
      "React Native",
      "Supabase",
      "Turborepo",
      "starter kit",
      "Stripe",
      "Vercel AI",
      "Row-Level Security",
    ],
    authors: [{ name: "Vyten LLC" }],
    icons,
    manifest: "/site.webmanifest",
    openGraph: {
      type: "website",
      locale: "en_US",
      title: appName,
      description,
      url: siteUrl,
      siteName: appName,
    },
    twitter: { card: "summary_large_image", title: appName, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

// The curated font set. Each exposes a CSS variable; the active theme
// (theme-settings global) selects which one `--font-sans`/`--font-mono` resolve
// to at runtime — see lib/theme/defaults.ts (FONT_*_OPTIONS). Variables are set
// on <html> so the :root `--font-sans` override resolves them.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
});
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

const fontVariables = cn(
  geistSans.variable,
  geistMono.variable,
  inter.variable,
  jetbrainsMono.variable,
  merriweather.variable,
  lora.variable,
);

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* No-flash theme detector: sets the light/dark/auto class on <html>
            before first paint. Injected via next/script `beforeInteractive` so it
            lands in the initial HTML and runs before hydration — and because Next
            injects it outside React's element tree, it avoids React 19's dev
            warning about <script> elements rendered by a component. */}
        <Script
          id="theme-detector"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeDetectorScript }}
        />
        <ThemeStyle />
      </head>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
        )}
      >
        <ThemeProvider>
          <Providers>{props.children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
