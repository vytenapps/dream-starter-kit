"use client";

import { useQuery } from "@tanstack/react-query";

import type {
  Post,
  Audio as AudioDoc,
  Event as EventDoc,
  Location as LocationDoc,
  Page,
  Photo,
  Plan,
  Video,
} from "@acme/cms";

/**
 * Cross-platform READ access to the Payload CMS REST API, typed with `@acme/cms`.
 *
 * Web Server Components should prefer Payload's Local API (see
 * apps/nextjs/src/lib/payload.ts) for SEO/perf; these hooks are for the Expo app
 * and any web client components. The CMS origin is inlined per platform from
 * `EXPO_PUBLIC_CMS_URL` (mobile) / `NEXT_PUBLIC_CMS_URL` (web); in the browser it
 * defaults to same-origin (relative) requests.
 */
// `process.env.*_PUBLIC_*` is inlined by each platform's bundler (Metro / Next).
// @acme/app intentionally carries no @types/node, so declare the slice we read.
declare const process: { env: Record<string, string | undefined> };

const CMS_BASE =
  process.env.EXPO_PUBLIC_CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

interface Paginated<T> {
  docs: T[];
  totalDocs: number;
}

async function cmsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CMS_BASE}/cms-api/${path}`);
  if (!res.ok) throw new Error(`CMS request failed (${res.status})`);
  return (await res.json()) as T;
}

const PUBLISHED = "where[_status][equals]=published";
const bySlug = (slug: string) =>
  `where[slug][equals]=${encodeURIComponent(slug)}`;

function useList<T>(
  collection: string,
  extraQuery = "",
  // audio/photos are draft-less upload collections (no `_status` to filter).
  { published = true }: { published?: boolean } = {},
) {
  return useQuery({
    queryKey: ["cms", collection, extraQuery, published],
    queryFn: () =>
      cmsFetch<Paginated<T>>(
        `${collection}?${published ? `${PUBLISHED}&` : ""}depth=1&limit=50${extraQuery}`,
      ).then((r) => r.docs),
  });
}

function useDoc<T>(collection: string, slug: string) {
  return useQuery({
    queryKey: ["cms", collection, "slug", slug],
    enabled: slug.length > 0,
    queryFn: () =>
      cmsFetch<Paginated<T>>(
        `${collection}?${bySlug(slug)}&${PUBLISHED}&depth=1&limit=1`,
      ).then((r) => r.docs[0] ?? null),
  });
}

export const usePosts = () =>
  useList<Post>("posts", "&sort=-publishedAt");
export const usePost = (slug: string) => useDoc<Post>("posts", slug);
export const useEvents = () => useList<EventDoc>("events", "&sort=startsAt");
export const useEvent = (slug: string) => useDoc<EventDoc>("events", slug);
export const useVideos = () => useList<Video>("videos");
export const useAudioTracks = () =>
  useList<AudioDoc>("audio", "&sort=-publishedAt", { published: false });
export const usePhotos = () =>
  useList<Photo>("photos", "&sort=-publishedAt", { published: false });
export const useLocations = () => useList<LocationDoc>("locations");
export const useLocation = (slug: string) =>
  useDoc<LocationDoc>("locations", slug);

/**
 * Active billing plans, ordered for display. Plans aren't draft/publish content
 * (gated by `active`), so this doesn't use the published filter. Used by the
 * native pricing screen; checkout itself is web-only (Stripe), so mobile links
 * out to the web pricing page to subscribe.
 */
export const usePlans = () =>
  useQuery({
    queryKey: ["cms", "plans"],
    queryFn: () =>
      cmsFetch<Paginated<Plan>>(
        `plans?where[active][equals]=true&sort=displayOrder&limit=50`,
      ).then((r) => r.docs),
  });

/**
 * A page (with its Launch UI block `layout`) by slug, depth 2 so block media
 * resolves. Lets the mobile app render the same CMS-driven pages as the web.
 */
export const usePage = (slug: string) =>
  useQuery({
    queryKey: ["cms", "pages", "slug", slug],
    enabled: slug.length > 0,
    queryFn: () =>
      cmsFetch<Paginated<Page>>(
        `pages?${bySlug(slug)}&${PUBLISHED}&depth=2&limit=1`,
      ).then((r) => r.docs[0] ?? null),
  });
