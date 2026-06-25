import { NextResponse } from "next/server";

import { getAuthSettings } from "~/lib/payload";

/**
 * Public, read-only front-end auth config — the `authentication-settings`
 * global, normalized to a complete AuthSettings (see lib/payload.ts →
 * getAuthSettings). Lets the Expo app and web client components learn which auth
 * methods to render and which client-side rules apply. Holds no secrets (read
 * access on the global is `anyone`).
 *
 * Web Server Components should read `getAuthSettings()` directly (SSR, no flash);
 * this endpoint exists for clients that can't use Payload's Local API — mirroring
 * the CMS REST hooks in @acme/app (use-content / use-auth-config). Briefly
 * CDN-cacheable since the config changes rarely.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAuthSettings();
  return NextResponse.json(settings, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
