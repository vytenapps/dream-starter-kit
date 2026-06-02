import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@acme/ui";
import { ThemeProvider, ThemeToggle } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { Providers } from "~/app/providers";
import { env } from "~/env";

import "~/app/styles.css";

const description =
  "Universal web + mobile starter — Next.js & Expo on one Supabase backend, with Row-Level Security, Stripe billing and AI built in.";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Dream Starter Kit",
    template: "%s · Dream Starter Kit",
  },
  applicationName: "Dream Starter Kit",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Dream Starter Kit",
    description,
    url: env.NEXT_PUBLIC_APP_URL,
    siteName: "Dream Starter Kit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dream Starter Kit",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <ThemeProvider>
          <Providers>{props.children}</Providers>
          <div className="absolute right-4 bottom-4">
            <ThemeToggle />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
