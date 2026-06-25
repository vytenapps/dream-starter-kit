"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuthSettings } from "../auth-settings";
import { DEFAULT_AUTH_SETTINGS, normalizeAuthSettings } from "../auth-settings";

/**
 * Front-end auth config for clients that can't use Payload's Local API — the
 * Expo app and web client components. Reads the public `/api/auth/config`
 * endpoint (served by the Next.js app). Web Server Components should call
 * `getAuthSettings()` (lib/payload.ts) directly for SSR instead.
 *
 * Origin is inlined per platform from EXPO_PUBLIC_CMS_URL (mobile) /
 * NEXT_PUBLIC_CMS_URL (web), same as the CMS content hooks; in the browser it
 * falls back to same-origin. Returns the kit defaults while loading or if the
 * endpoint is unreachable, so the auth screens always render.
 */
// `process.env.*_PUBLIC_*` is inlined by each platform's bundler (Metro / Next).
declare const process: { env: Record<string, string | undefined> };

const APP_BASE =
  process.env.EXPO_PUBLIC_CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

export function useAuthConfig(): AuthSettings {
  const { data } = useQuery({
    queryKey: ["auth-config"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AuthSettings> => {
      const res = await fetch(`${APP_BASE}/api/auth/config`);
      if (!res.ok) throw new Error(`auth config failed (${res.status})`);
      return normalizeAuthSettings(await res.json());
    },
  });
  return data ?? DEFAULT_AUTH_SETTINGS;
}
