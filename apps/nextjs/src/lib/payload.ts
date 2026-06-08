import "server-only";

import { cache } from "react";
import config from "@payload-config";
import { getPayload } from "payload";

import type {
  Article,
  Audio as AudioDoc,
  Event as EventDoc,
  Location as LocationDoc,
  Page,
  Photo,
  SiteSetting,
  Video,
} from "@acme/cms";
import { APP_NAME } from "@acme/config/constants";

import type { ThemeSettingsInput } from "./theme/defaults";

/**
 * Server-side access to Payload via its LOCAL API (in-process, no HTTP) — the
 * right choice for public Server Components (SEO/perf). Client components and
 * the Expo app use the REST hooks in `@acme/app` (use-content) instead.
 *
 * Reads degrade gracefully: if the CMS isn't reachable or hasn't been migrated
 * yet (e.g. a placeholder-env deploy before Payload is configured), the public
 * pages render an empty state rather than 500-ing.
 */
const client = () => getPayload({ config });

const PUBLISHED = { _status: { equals: "published" } };
const publishedSlug = (slug: string) => ({
  and: [{ slug: { equals: slug } }, PUBLISHED],
});

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export function getPage(slug: string): Promise<Page | null> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "pages",
      where: publishedSlug(slug),
      limit: 1,
    });
    return docs[0] ?? null;
  }, null);
}

export function listArticles(): Promise<Article[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "articles",
      where: PUBLISHED,
      sort: "-publishedAt",
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function getArticle(slug: string): Promise<Article | null> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "articles",
      where: publishedSlug(slug),
      depth: 1,
      limit: 1,
    });
    return docs[0] ?? null;
  }, null);
}

export function listEvents(): Promise<EventDoc[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "events",
      where: PUBLISHED,
      sort: "startsAt",
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function getEvent(slug: string): Promise<EventDoc | null> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "events",
      where: publishedSlug(slug),
      depth: 1,
      limit: 1,
    });
    return docs[0] ?? null;
  }, null);
}

export function listVideos(): Promise<Video[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "videos",
      where: PUBLISHED,
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function listAudio(): Promise<AudioDoc[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "audio",
      where: PUBLISHED,
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function listPhotos(): Promise<Photo[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "photos",
      where: PUBLISHED,
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function listLocations(): Promise<LocationDoc[]> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "locations",
      where: PUBLISHED,
      depth: 1,
      limit: 100,
    });
    return docs;
  }, []);
}

export function getLocation(slug: string): Promise<LocationDoc | null> {
  return safe(async () => {
    const payload = await client();
    const { docs } = await payload.find({
      collection: "locations",
      where: publishedSlug(slug),
      depth: 1,
      limit: 1,
    });
    return docs[0] ?? null;
  }, null);
}

/**
 * The SiteSettings global. Callers (e.g. the public header) handle failure with
 * their own fallback, so this is allowed to throw if the CMS is unavailable.
 */
export async function getSiteSettings(): Promise<SiteSetting> {
  const payload = await client();
  return payload.findGlobal({ slug: "site-settings" });
}

/**
 * The raw theme-settings global, fetched once per request and shared by all
 * theme/branding readers (<ThemeStyle />, the (app) layout's branding, and the
 * route metadata). `cache` dedupes so a single page render hits Payload once,
 * not three times — keeping the global read off the critical render path.
 */
const themeGlobal = cache(async () =>
  (await client()).findGlobal({ slug: "theme-settings", depth: 1 }),
);

/**
 * The site-wide shadcn theme (theme-settings global). Read by <ThemeStyle /> in
 * both the front end and the Payload admin. Degrades to `null` if the CMS isn't
 * reachable/migrated — the serializer then falls back to the built-in defaults,
 * so the app is never unthemed.
 */
export function getThemeSettings(): Promise<ThemeSettingsInput | null> {
  return safe(
    async () => (await themeGlobal()) as unknown as ThemeSettingsInput,
    null,
  );
}

export interface Branding {
  appName: string;
  appIconUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
}

const mediaUrl = (v: unknown): string | null =>
  v && typeof v === "object" && "url" in v
    ? ((v as { url?: string | null }).url ?? null)
    : null;

/**
 * Branding derived from the theme-settings global (app name + uploaded
 * icon/logos), populated one level deep so media URLs resolve. Degrades to
 * APP_NAME / no images when the CMS is unavailable.
 */
export function getBranding(): Promise<Branding> {
  return safe(
    async () => {
      const g = (await themeGlobal()) as unknown as {
        appName?: string | null;
        appIcon?: unknown;
        logoLight?: unknown;
        logoDark?: unknown;
      };
      const trimmedName = g.appName?.trim();
      return {
        appName: trimmedName?.length ? trimmedName : APP_NAME,
        appIconUrl: mediaUrl(g.appIcon),
        logoLightUrl: mediaUrl(g.logoLight),
        logoDarkUrl: mediaUrl(g.logoDark),
      };
    },
    {
      appName: APP_NAME,
      appIconUrl: null,
      logoLightUrl: null,
      logoDarkUrl: null,
    },
  );
}
