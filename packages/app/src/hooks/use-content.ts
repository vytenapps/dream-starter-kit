"use client";

import { useQuery } from "@tanstack/react-query";

import type {
  Article,
  Audio as AudioDoc,
  Event as EventDoc,
  Location as LocationDoc,
  Photo,
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

function useList<T>(collection: string, extraQuery = "") {
  return useQuery({
    queryKey: ["cms", collection, extraQuery],
    queryFn: () =>
      cmsFetch<Paginated<T>>(
        `${collection}?${PUBLISHED}&depth=1&limit=50${extraQuery}`,
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

export const useArticles = () =>
  useList<Article>("articles", "&sort=-publishedAt");
export const useArticle = (slug: string) => useDoc<Article>("articles", slug);
export const useEvents = () => useList<EventDoc>("events", "&sort=startsAt");
export const useEvent = (slug: string) => useDoc<EventDoc>("events", slug);
export const useVideos = () => useList<Video>("videos");
export const useAudioTracks = () => useList<AudioDoc>("audio");
export const usePhotos = () => useList<Photo>("photos");
export const useLocations = () => useList<LocationDoc>("locations");
export const useLocation = (slug: string) =>
  useDoc<LocationDoc>("locations", slug);
