/**
 * Payload demo content seed (Local API). Idempotent: bails if pages already
 * exist. Creates scalar-only content; collections that require an uploaded
 * asset (audio, photos) are left for editors to add via the admin so the seed
 * needs no binary fixtures.
 *
 * Two entry points share `seedCmsContent`:
 *   - the CLI (`pnpm cms:seed`) — runs after `pnpm cms:migrate` builds the `cms`
 *     schema; creates a demo admin if none exists. Used for headless/CI setup.
 *   - the first-admin onboarding flow (`/api/cms/seed` → `/cms-setup`) — runs
 *     automatically when the first Payload admin is created, reporting progress.
 */
import type { Payload } from "payload";
import { getPayload } from "payload";

import { extSeedSteps } from "../ext/registry.payload.generated";
import {
  SITE_FOOTER_COLUMNS,
  SITE_FOOTER_POLICIES,
  SITE_HEADER,
  SITE_HEADER_ACTIONS,
  SITE_SOCIAL,
} from "../lib/site-chrome";
import config from "../payload.config";

/** Reports seed progress: `done`/`total` steps complete, with the step label. */
export type SeedProgress = (done: number, total: number, label: string) => void;

/** Build a minimal Lexical rich-text value from plain paragraphs (for prose). */
function richText(paragraphs: string[]) {
  return {
    root: {
      type: "root",
      format: "" as const,
      indent: 0,
      version: 1,
      direction: "ltr" as const,
      children: paragraphs.map((text) => ({
        type: "paragraph",
        format: "" as const,
        indent: 0,
        version: 1,
        direction: "ltr" as const,
        children: [
          {
            type: "text",
            text,
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
            version: 1,
          },
        ],
      })),
    },
  };
}

/**
 * Seed demo CMS content. Idempotent — returns `{ seeded: false }` without
 * changes if pages already exist. Assigns the first existing admin as post
 * author when present; only creates the demo `editor@example.com` admin when no
 * users exist at all (the CLI path).
 */
export async function seedCmsContent(
  payload: Payload,
  onProgress?: SeedProgress,
): Promise<{ seeded: boolean }> {
  const existingPages = await payload.find({ collection: "pages", limit: 0 });
  if (existingPages.totalDocs > 0) {
    payload.logger.info("CMS already seeded — skipping.");
    return { seeded: false };
  }

  // Use the first existing admin (e.g. the just-created first user) as author;
  // otherwise create a placeholder author. Auth is SSO-only (no Payload password):
  // real editors are provisioned from their Supabase session by the auth bridge, so
  // this demo row exists only as a post author for the CLI/headless path.
  const users = await payload.find({ collection: "users", limit: 1 });
  let authorId = users.docs[0]?.id;
  if (!authorId) {
    const demo = await payload.create({
      collection: "users",
      data: {
        email: "editor@example.com",
        name: "Demo Editor",
        roles: ["admin"],
      },
    });
    authorId = demo.id;
    payload.logger.info("Created placeholder author: editor@example.com");
  }

  // Ordered steps; progress is reported after each completes.
  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: "Site settings",
      run: async () => {
        // Header nav, action buttons, footer columns/policies and social all
        // come from the single source of truth in `lib/site-chrome.ts`, which
        // the header/footer also use as their pre-seed fallback — so the site
        // chrome is identical before and after seeding. Edit it there.
        await payload.updateGlobal({
          slug: "site-settings",
          data: {
            header: SITE_HEADER,
            headerActions: SITE_HEADER_ACTIONS,
            footerColumns: SITE_FOOTER_COLUMNS,
            footerPolicies: SITE_FOOTER_POLICIES,
            social: SITE_SOCIAL,
          },
        });
      },
    },
    {
      label: "Pages",
      run: async () => {
        // Home: a full Launch UI marketing layout, composed the way the Launch
        // UI site recommends — hero → social proof (logos) → feature highlights
        // → stats → CTA → FAQ. Feature cards carry an optional `tooltip` with
        // the deeper technical detail (rendered as an (i) shadcn tooltip), so
        // the copy stays plain-English for non-technical founders.
        await payload.create({
          collection: "pages",
          data: {
            title: "Home",
            slug: "home",
            _status: "published",
            layout: [
              {
                blockType: "hero",
                title: "Give your idea the app it deserves",
                description:
                  "A clone-and-ship starter kit: a polished website plus iPhone and Android apps, all sharing one secure backend. Logins, payments, an admin dashboard and an AI assistant come already built — so you start at 80%, not from a blank page.",
                badgeText: "Web · iOS · Android",
                badgeLinkText: "See everything inside",
                badgeLinkHref: "/features",
                buttons: [
                  { text: "Get started", href: "/sign-up", variant: "default" },
                  {
                    text: "Explore features",
                    href: "/features",
                    variant: "glow",
                  },
                ],
              },
              {
                blockType: "logos",
                title:
                  "Built on the platforms behind the world's best-known apps",
                logos: [
                  { name: "Next.js" },
                  { name: "Supabase" },
                  { name: "Stripe" },
                  { name: "Expo" },
                  { name: "Vercel" },
                  { name: "Payload" },
                ],
              },
              {
                blockType: "items",
                title: "One codebase. Every screen your customers touch.",
                items: [
                  {
                    title: "A real website",
                    description:
                      "A fast, search-friendly marketing site and web app your customers use in any browser.",
                    tooltip:
                      "Next.js (App Router) with server-rendered pages for SEO, deployed on Vercel.",
                    icon: "Globe",
                  },
                  {
                    title: "iPhone & Android apps",
                    description:
                      "Native mobile apps for both app stores, built from the very same project as your website.",
                    tooltip:
                      "A single Expo (React Native) app targeting iOS and Android, shipped via EAS cloud builds — no Mac required.",
                    icon: "Smartphone",
                  },
                  {
                    title: "One shared backend",
                    description:
                      "Web and mobile read and write the same data, so everything stays in sync automatically.",
                    tooltip:
                      "One Supabase project (Postgres + Auth + Storage) serves every client; there are no duplicate APIs to maintain.",
                    icon: "Layers",
                  },
                  {
                    title: "Write once, use everywhere",
                    description:
                      "Your business rules and data screens are written a single time and reused across web and mobile.",
                    tooltip:
                      "Shared TypeScript packages hold the validators and React Query hooks consumed by both apps.",
                    icon: "Code",
                  },
                ],
              },
              {
                blockType: "items",
                title: "The expensive 80% — already built",
                items: [
                  {
                    title: "Secure logins",
                    description:
                      "Sign-up, login, social login, password reset and email confirmation — done and tested.",
                    tooltip:
                      "Supabase Auth with email/password, Google & Apple OAuth, and token-hash email verification.",
                    icon: "Lock",
                  },
                  {
                    title: "User profiles",
                    description:
                      "Every member gets an editable profile with avatar, bio and custom fields you control.",
                    tooltip:
                      "A profiles table (Row-Level Security) plus staff-defined custom fields surfaced on web and native.",
                    icon: "Users",
                  },
                  {
                    title: "Payments & subscriptions",
                    description:
                      "Take recurring or one-time payments and let customers manage their own billing.",
                    tooltip:
                      "Stripe Checkout + billing portal; plans and coupons are authored in your dashboard and auto-synced to Stripe.",
                    icon: "Zap",
                  },
                  {
                    title: "An AI assistant",
                    description:
                      "A built-in chat assistant that remembers each conversation, ready to brand as your own.",
                    tooltip:
                      "Streaming chat via the Vercel AI SDK + AI Gateway, defaulting to Claude; prompt and history are tunable in the admin.",
                    icon: "Sparkles",
                  },
                  {
                    title: "Notifications & reminders",
                    description:
                      "Send announcements and push alerts, and let users schedule their own reminders.",
                    tooltip:
                      "In-app feed + Expo push tokens; a scheduled edge function fires due reminders.",
                    icon: "Bell",
                  },
                  {
                    title: "An admin dashboard",
                    description:
                      "A full back-office where you and your team manage content, users and pricing — no code.",
                    tooltip:
                      "Payload CMS at /admin, single sign-on from Supabase with role-based access.",
                    icon: "Settings",
                  },
                ],
              },
              {
                blockType: "stats",
                items: [
                  {
                    label: "runs on",
                    value: "3",
                    description: "web, iOS & Android — one project",
                  },
                  {
                    label: "shared",
                    value: "1",
                    description: "backend, database & login system",
                  },
                  {
                    label: "to start",
                    value: "$0",
                    description: "free tiers until you have customers",
                  },
                  {
                    label: "TypeScript",
                    value: "100",
                    suffix: "%",
                    description: "end to end, for fewer bugs",
                  },
                ],
              },
              {
                blockType: "cta",
                title: "Start building today",
                buttons: [
                  { text: "Get started", href: "/sign-up", variant: "default" },
                  {
                    text: "See all features",
                    href: "/features",
                    variant: "glow",
                  },
                ],
              },
              {
                blockType: "faq",
                title: "Frequently asked questions",
                items: [
                  {
                    question: "Do I need to know how to code?",
                    answer:
                      "No. The hard parts are already built, and your day-to-day — content, pricing, users and branding — is managed from a visual admin dashboard. When you do want changes, you (or an AI assistant) work from a clean, well-documented codebase.",
                  },
                  {
                    question: "Do I own everything?",
                    answer:
                      "Yes. You clone the kit and own the code outright — no developer or platform holds the keys. Host it anywhere; there is no lock-in, and you keep 100% of your equity.",
                  },
                  {
                    question: "What does it cost to start?",
                    answer:
                      "Nothing. The kit and the services it runs on (web hosting, database, app builds) all have free tiers, so you pay $0 until you have real customers and usage.",
                  },
                  {
                    question: "Does it really work on iPhone and Android?",
                    answer:
                      "Yes. One project produces a website plus native iOS and Android apps that share the same backend, logins and data — so a change in one place shows up everywhere.",
                  },
                  {
                    question: "How fast can I launch?",
                    answer:
                      "You can deploy the kit and have a working website and app the same day. Because logins, payments, content and the admin dashboard are already wired up, you spend your time on what makes your product unique — not boilerplate.",
                  },
                  {
                    question: "Can I take payments and run subscriptions?",
                    answer:
                      "Yes. Stripe checkout, subscriptions, one-time purchases, coupons, intro offers and a self-serve billing portal are built in. You create and edit your plans and prices from the admin dashboard — no developer required.",
                  },
                  {
                    question: "Is my data secure?",
                    answer:
                      "Yes. Every customer can only ever see or change their own data — enforced by the database itself, not just app code — and that protection is automatically tested on every change. Payments run through Stripe, so card details never touch your servers.",
                  },
                  {
                    question: "Can I make it look like my brand?",
                    answer:
                      "Completely. Set your app name, logo, favicon, colors and fonts from the admin dashboard and they apply across web and mobile instantly. Light and dark modes are included, and you can preview changes before publishing.",
                  },
                  {
                    question: "What if I need a feature that isn't included?",
                    answer:
                      "Features install as self-contained “extensions” — add, update or remove them cleanly without breaking the rest of your app. The kit ships with several (payments, AI chat, notifications, reminders, a dashboard) and you can build or install more.",
                  },
                  {
                    question: "What happens when I outgrow building it myself?",
                    answer:
                      "Nothing breaks. It's built on the same production stack used to launch 100+ apps, so it scales with you — and because you own the code, you can bring on a developer or a done-for-you team to take over the exact same codebase, with no rewrite.",
                  },
                  {
                    question: "Is there a free version of the kit?",
                    answer:
                      "The starter kit is open and yours to clone. Have a look at the Features page for the full tour, then create an account to get started.",
                  },
                ],
              },
            ],
          },
        });

        // Features: the in-depth tour, linked from the header nav. Built the
        // way the Launch UI site lays out a features page — a feature hero,
        // then detailed feature blocks grouped by area, metrics, and a closing
        // CTA. Every card is plain-English; the (i) tooltip carries the
        // technical specifics for anyone who wants them.
        await payload.create({
          collection: "pages",
          data: {
            title: "Features",
            slug: "features",
            _status: "published",
            layout: [
              {
                blockType: "hero",
                title: "Everything you need to ship — already built",
                description:
                  "Here is what comes in the box. Each card explains the feature in plain English; hover or tap the (i) for the technical detail.",
                badgeText: "Features",
                buttons: [
                  { text: "Get started", href: "/sign-up", variant: "default" },
                  { text: "See pricing", href: "/pricing", variant: "glow" },
                ],
              },
              {
                blockType: "items",
                title: "Web + mobile from one codebase",
                items: [
                  {
                    title: "A real website",
                    description:
                      "A fast, search-friendly site and web app that works in any browser.",
                    tooltip:
                      "Next.js (App Router) with server-rendered pages for SEO, deployed on Vercel.",
                    icon: "Globe",
                  },
                  {
                    title: "iPhone & Android apps",
                    description:
                      "Native apps for both app stores, built from the same project.",
                    tooltip:
                      "One Expo (React Native) app for iOS and Android, shipped via EAS cloud builds.",
                    icon: "Smartphone",
                  },
                  {
                    title: "One shared backend",
                    description:
                      "Web and mobile use the same data, kept in sync automatically.",
                    tooltip:
                      "A single Supabase project (Postgres + Auth + Storage) serves every client.",
                    icon: "Layers",
                  },
                  {
                    title: "Write once, use everywhere",
                    description:
                      "Logic and data screens are written once and reused across platforms.",
                    tooltip:
                      "Shared TypeScript packages hold validators and React Query hooks for both apps.",
                    icon: "Code",
                  },
                  {
                    title: "Polished UI components",
                    description:
                      "A consistent, themeable set of buttons, forms and layouts everywhere.",
                    tooltip:
                      "shadcn/ui + Tailwind on web; react-native-reusables + NativeWind on native.",
                    icon: "Palette",
                  },
                  {
                    title: "Fast, responsive data",
                    description:
                      "Screens load quickly and stay snappy by caching data intelligently.",
                    tooltip:
                      "TanStack Query caches and revalidates; sessions persist across app launches.",
                    icon: "Cloud",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Accounts & security",
                items: [
                  {
                    title: "Email sign-up & login",
                    description:
                      "Customers create accounts and sign in with email and password.",
                    tooltip:
                      "Supabase Auth with httpOnly cookie sessions on web and secure storage on native.",
                    icon: "Lock",
                  },
                  {
                    title: "Social login",
                    description:
                      "One-tap sign-in with Google or Apple — no password to remember.",
                    tooltip:
                      "Supabase OAuth using PKCE deep-link callbacks for mobile.",
                    icon: "Users",
                  },
                  {
                    title: "Email confirmation & reset",
                    description:
                      "Verify new emails and let users reset forgotten passwords themselves.",
                    tooltip:
                      "Custom token-hash email templates that survive prefetching and re-sends, with a 6-digit code fallback.",
                    icon: "Mail",
                  },
                  {
                    title: "Team invites & roles",
                    description:
                      "Invite teammates and control what each can do — admin, editor or author.",
                    tooltip:
                      "Invite-only staff provisioning via the server-side service role; WordPress-style roles in the CMS.",
                    icon: "Check",
                  },
                  {
                    title: "Private by default",
                    description:
                      "Each person can only ever see or change their own data — enforced by the database.",
                    tooltip:
                      "Row-Level Security on every table, scoped to the signed-in user, regression-tested in CI.",
                    icon: "ShieldCheck",
                  },
                  {
                    title: "Account deletion",
                    description:
                      "Users can permanently delete their account and data in one tap.",
                    tooltip:
                      "A service-role edge function deletes the auth user; Postgres cascades remove every owned row.",
                    icon: "Settings",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Payments & subscriptions",
                items: [
                  {
                    title: "Checkout that just works",
                    description:
                      "Sell subscriptions or one-time purchases through a secure, hosted payment page.",
                    tooltip:
                      "Stripe Checkout — your server never touches card data, so PCI compliance is handled for you.",
                    icon: "Zap",
                  },
                  {
                    title: "Pricing managed by you",
                    description:
                      "Create and edit plans, prices and a free tier from your dashboard — no developer.",
                    tooltip:
                      "Plans authored in Payload auto-sync to Stripe; price changes recreate immutable Stripe prices.",
                    icon: "ChartBar",
                  },
                  {
                    title: "Coupons & intro offers",
                    description:
                      "Run promos like “$1.99 first month, then $39.99” with no codes to share.",
                    tooltip:
                      "Intro offers become auto-applied Stripe coupons (once or repeating duration).",
                    icon: "Star",
                  },
                  {
                    title: "Guest checkout",
                    description:
                      "Let visitors buy before signing up; their account is created right after.",
                    tooltip:
                      "The webhook matches the Stripe email to an existing account or invites a new one.",
                    icon: "Globe",
                  },
                  {
                    title: "Self-serve billing",
                    description:
                      "Customers update cards, change plans, cancel and download invoices on their own.",
                    tooltip:
                      "Stripe Billing Portal at /billing — cuts your support load to near zero.",
                    icon: "Settings",
                  },
                  {
                    title: "Plan-based access",
                    description:
                      "Unlock premium features automatically from someone's plan — on web and mobile.",
                    tooltip:
                      "Subscriptions mirrored to RLS tables; a usePremium() check gates features and users are auto-tagged by plan.",
                    icon: "Lock",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Content & your admin dashboard",
                items: [
                  {
                    title: "A no-code admin",
                    description:
                      "A clean back-office for your whole team to run the product without touching code.",
                    tooltip:
                      "Payload CMS v3 at /admin, single sign-on from Supabase, with role-based access.",
                    icon: "Settings",
                  },
                  {
                    title: "Visual page builder",
                    description:
                      "Build marketing pages by stacking ready-made sections — like this very page.",
                    tooltip:
                      "Pages composed from hero/items/stats/CTA/FAQ/prose blocks, rendered server-side for SEO.",
                    icon: "Layers",
                  },
                  {
                    title: "Blog & articles",
                    description:
                      "Publish posts with scheduling, categories, SEO and draft previews.",
                    tooltip:
                      "Posts collection with drafts, version history, scheduled publish and an SEO plugin.",
                    icon: "Globe",
                  },
                  {
                    title: "Video & vertical shorts",
                    description:
                      "Host landscape videos and TikTok-style vertical shorts.",
                    tooltip:
                      "Videos collection with orientation + source (upload/YouTube/Vimeo/Mux), chapters and captions.",
                    icon: "Smartphone",
                  },
                  {
                    title: "Podcasts & audio",
                    description:
                      "Publish audio episodes with automatic feeds, including members-only feeds.",
                    tooltip:
                      "Audio collection generates RSS with iTunes metadata and per-member tokenized private feeds.",
                    icon: "Cloud",
                  },
                  {
                    title: "Photo galleries",
                    description:
                      "Create albums and galleries with captions, credits and locations.",
                    tooltip:
                      "Photos collection (upload-based) with albums, focal-point cropping and capture metadata.",
                    icon: "Palette",
                  },
                  {
                    title: "Courses & lessons",
                    description:
                      "Bundle content into courses with progress tracking and timed unlocks.",
                    tooltip:
                      "Series/courses + lessons with enrollments, completion %, and scheduled or relative drip release.",
                    icon: "ChartBar",
                  },
                  {
                    title: "Events, places & community",
                    description:
                      "Run events with RSVPs, list venues with maps and reviews, and host member discussions.",
                    tooltip:
                      "Events and Locations (moderated reviews) collections plus community spaces, threaded comments and a reports queue.",
                    icon: "Users",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Engagement & AI",
                items: [
                  {
                    title: "AI assistant",
                    description:
                      "A built-in chat assistant that remembers each conversation, ready to make your own.",
                    tooltip:
                      "Streaming chat via the Vercel AI SDK + AI Gateway (Claude by default); routes are authed, rate-limited and token-capped.",
                    icon: "Sparkles",
                  },
                  {
                    title: "Push notifications",
                    description:
                      "Reach customers on their phone with alerts that deep-link into the app.",
                    tooltip:
                      "Expo Push with per-device tokens; sent from the admin or triggered by other features.",
                    icon: "Bell",
                  },
                  {
                    title: "In-app notification feed",
                    description:
                      "A bell and feed so users never miss an update, even with push turned off.",
                    tooltip:
                      "A notifications table (RLS read-own) read by both web and native.",
                    icon: "Mail",
                  },
                  {
                    title: "Scheduled reminders",
                    description:
                      "Users set reminders that arrive at the right time as push and in-app messages.",
                    tooltip:
                      "A reminders table plus a scheduled edge function that fans out due reminders.",
                    icon: "Check",
                  },
                  {
                    title: "Favorites & bookmarks",
                    description:
                      "Let users save any content to come back to later.",
                    tooltip:
                      "A polymorphic favorites collection keyed per user and target.",
                    icon: "Heart",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Branding & design",
                items: [
                  {
                    title: "Make it yours",
                    description:
                      "Set your app name, logo and favicon from one place — no redeploy.",
                    tooltip:
                      "Branding fields in the theme-settings global, read server-side and applied across the app.",
                    icon: "Sparkles",
                  },
                  {
                    title: "Your colors & fonts",
                    description:
                      "Pick your brand colors and fonts; they apply across web and mobile instantly.",
                    tooltip:
                      "Editable shadcn theme (OKLCH tokens) plus curated next/font sets, versioned draft → publish.",
                    icon: "Palette",
                  },
                  {
                    title: "Dark mode included",
                    description:
                      "Light and dark themes ship out of the box and follow each device's setting.",
                    tooltip:
                      "Paired light/dark token sets injected server-side to avoid a flash of unstyled content.",
                    icon: "Star",
                  },
                  {
                    title: "Preview before you publish",
                    description:
                      "Stage theme and page changes as drafts, then publish when you're ready.",
                    tooltip:
                      "Payload versioned globals and collections; the live site always renders the published version.",
                    icon: "Check",
                  },
                ],
              },
              {
                blockType: "items",
                title: "Built to grow — and you own it",
                items: [
                  {
                    title: "You own the code",
                    description:
                      "Clone it and it's yours — no platform or developer holds the keys.",
                    tooltip:
                      "An open codebase you host anywhere, with a permissive dependency tree (no GPL/AGPL) checked in CI.",
                    icon: "Lock",
                  },
                  {
                    title: "$0 to start",
                    description:
                      "Run entirely on free tiers until you have paying customers.",
                    tooltip:
                      "Vercel, Supabase and Expo free tiers cover early usage.",
                    icon: "Rocket",
                  },
                  {
                    title: "One-click deploy",
                    description:
                      "Go live in minutes; the database sets itself up on first boot.",
                    tooltip:
                      "Vercel deploy plus a runtime bootstrap that applies migrations and provisions the CMS automatically.",
                    icon: "Cloud",
                  },
                  {
                    title: "Add features as extensions",
                    description:
                      "Bolt on new capabilities cleanly — add, update or remove without breakage.",
                    tooltip:
                      "Self-contained extension packages with their own tables, screens, routes, settings and migrations.",
                    icon: "Layers",
                  },
                  {
                    title: "Built to stay correct",
                    description:
                      "Automated tests and type-checking catch mistakes before customers do.",
                    tooltip:
                      "TypeScript end-to-end with Vitest, Playwright E2E and RLS regression tests running in CI.",
                    icon: "ShieldCheck",
                  },
                  {
                    title: "Production-grade stack",
                    description:
                      "The same foundation used to launch 100+ apps, on infrastructure the biggest apps trust.",
                    tooltip:
                      "Next.js, Expo, Supabase, Stripe and Payload on Vercel — no rebuild wall as you scale.",
                    icon: "Star",
                  },
                ],
              },
              {
                blockType: "stats",
                items: [
                  {
                    label: "pre-built features",
                    value: "30",
                    suffix: "+",
                    description: "across auth, payments, content & AI",
                  },
                  {
                    label: "runs on",
                    value: "3",
                    description: "web, iOS & Android",
                  },
                  {
                    label: "to start",
                    value: "$0",
                    description: "free tiers until you sell",
                  },
                  {
                    label: "your equity",
                    value: "100",
                    suffix: "%",
                    description: "you keep all of it",
                  },
                ],
              },
              {
                blockType: "cta",
                title: "Start building today",
                buttons: [
                  { text: "Get started", href: "/sign-up", variant: "default" },
                  { text: "See pricing", href: "/pricing", variant: "glow" },
                ],
              },
            ],
          },
        });

        // Text/legal pages render through a single prose block.
        const prose = [
          {
            title: "About",
            slug: "about",
            heading: "About this project",
            body: [
              "This is the Dream Starter Kit — a clone-and-ship foundation for building web and mobile products on one backend.",
              "Edit this page from the Payload admin: add hero, feature, stats, CTA, FAQ or prose sections.",
            ],
          },
          {
            title: "Contact",
            slug: "contact",
            heading: "Get in touch",
            body: [
              "Questions or feedback? Reach out and we'll get back to you.",
            ],
          },
          {
            title: "Terms of Service",
            slug: "terms",
            heading: "Terms of Service",
            body: [
              "These are placeholder terms. Replace this content with your own from the admin.",
            ],
          },
          {
            title: "Privacy Policy",
            slug: "privacy",
            heading: "Privacy Policy",
            body: [
              "This is a placeholder privacy policy. Replace this content with your own from the admin.",
            ],
          },
        ];
        for (const page of prose) {
          await payload.create({
            collection: "pages",
            data: {
              title: page.title,
              slug: page.slug,
              _status: "published",
              layout: [
                {
                  blockType: "prose",
                  title: page.heading,
                  content: richText(page.body),
                },
              ],
            },
          });
        }
      },
    },
    {
      label: "Posts",
      run: async () => {
        await payload.create({
          collection: "posts",
          data: {
            title: "Welcome to the kit",
            slug: "welcome-to-the-kit",
            excerpt: "Your content-driven starter is ready to extend.",
            body: richText([
              "Welcome to the Dream Starter Kit. This post is demo content seeded into the Payload CMS so the blog renders end to end on a fresh clone.",
              "Edit or delete it from the admin at /admin, then publish your own posts. Posts support a hero image, an excerpt and this rich-text body.",
            ]),
            author: authorId,
            publishedAt: "2026-01-01T00:00:00.000Z",
            _status: "published",
          },
        });
        await payload.create({
          collection: "posts",
          data: {
            title: "Modeling content in Payload",
            slug: "modeling-content-in-payload",
            excerpt: "Posts, events, media and more — all in the cms schema.",
            body: richText([
              "Payload CMS owns the cms Postgres schema and powers every editorial collection in this kit: posts, events, videos, photos, audio and locations.",
              "Each collection is a thin config file under src/payload/collections. Add a field, run pnpm cms:gen-types, and it flows straight through to the typed web and mobile screens.",
            ]),
            author: authorId,
            publishedAt: "2026-01-02T00:00:00.000Z",
            _status: "published",
          },
        });
      },
    },
    {
      label: "Location",
      run: async () => {
        await payload.create({
          collection: "locations",
          data: {
            name: "Demo HQ",
            slug: "demo-hq",
            shortDescription: "A sample location record.",
            address: {
              street: "123 Demo St",
              city: "Demo City",
              region: "CA",
              postalCode: "90210",
              country: "USA",
            },
            description: richText([
              "Demo HQ is a sample location record. Locations pair an address with a rich-text description — use them for stores, venues or offices.",
              "Replace this with your own places from the admin, or delete the locations collection if your product doesn't need it.",
            ]),
            _status: "published",
          },
        });
      },
    },
    {
      label: "Event",
      run: async () => {
        await payload.create({
          collection: "events",
          data: {
            title: "Launch day",
            slug: "launch-day",
            startsAt: "2026-02-01T18:00:00.000Z",
            description: richText([
              "Launch day is a demo event. Events carry a start time and a rich-text description for the agenda, location and details.",
              "This one is seeded so the events list and detail pages render out of the box — edit or remove it from the admin.",
            ]),
            _status: "published",
          },
        });
      },
    },
    {
      label: "Video",
      run: async () => {
        await payload.create({
          collection: "videos",
          data: {
            title: "Intro video",
            slug: "intro-video",
            orientation: "landscape",
            sourceType: "url",
            url: "https://example.com/intro.mp4",
            _status: "published",
          },
        });
      },
    },
  ];

  // Framework step: populate the extension registry + CMS-driven menu from
  // the generated defaults (same reconcile the server runs at every boot).
  steps.push({
    label: "Navigation menu",
    run: async () => {
      const { reconcileExtensions } = await import("../lib/ext/reconcile-nav");
      await reconcileExtensions(payload);
    },
  });

  // Seed steps contributed by installed extensions (generated registry) —
  // they ride the same idempotent progress flow as the core steps.
  for (const extStep of extSeedSteps) {
    steps.push({ label: extStep.label, run: () => extStep.run(payload) });
  }

  const total = steps.length;
  for (const [i, step] of steps.entries()) {
    await step.run();
    onProgress?.(i + 1, total, step.label);
  }

  payload.logger.info("CMS seed complete.");
  return { seeded: true };
}

/** CLI entry point: `pnpm cms:seed`. */
async function main() {
  const payload = await getPayload({ config });
  await seedCmsContent(payload);
}

// Only run as a script when invoked directly (not when imported by the API
// route). `tsx src/payload/seed.ts` sets import.meta.url to this file.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  void main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
