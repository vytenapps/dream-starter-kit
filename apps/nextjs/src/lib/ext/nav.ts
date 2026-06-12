import "server-only";

import { cache } from "react";

import type { NavMenuItem } from "./nav-types";
import { desiredNavItems } from "./reconcile-nav";

export type { NavMenuItem } from "./nav-types";

/**
 * The web app menu, resolved server-side from the CMS-driven `nav-items`
 * collection (staff-edited: rename/reorder/re-icon/toggle — live without a
 * redeploy), filtered to enabled items of enabled extensions and sorted by
 * Payload's drag order. Falls back to the generated defaults when the CMS is
 * unreachable (fresh deploy before bootstrap, local Postgres down) so the app
 * shell always renders.
 *
 * Per-request memoized via React cache() like every lib/payload.ts reader —
 * no cross-request cache, so menu edits in /admin appear on the next request.
 */
export const getWebNavItems = cache(async (): Promise<NavMenuItem[]> => {
  try {
    const [{ default: config }, { getPayload }] = await Promise.all([
      import("@payload-config"),
      import("payload"),
    ]);
    const payload = await getPayload({ config });
    const [navRes, extRes] = await Promise.all([
      payload.find({
        collection: "nav-items",
        sort: "_order",
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: "kit-extensions",
        where: { enabled: { equals: false } },
        pagination: false,
        overrideAccess: true,
      }),
    ]);
    const disabled = new Set(extRes.docs.map((d) => d.slug));
    const items = navRes.docs
      .filter((d) => d.enabled !== false)
      .filter((d) => (d.platforms ?? []).includes("web"))
      .filter((d) => {
        const ext =
          typeof d.extension === "object" ? d.extension?.slug : undefined;
        return !ext || !disabled.has(ext);
      })
      .map((d) => ({
        key: d.key,
        label: d.label,
        href: d.href,
        icon: d.icon ?? undefined,
      }));
    // An empty collection means the boot reconcile hasn't run yet (fresh DB
    // mid-request) — fall back to defaults rather than rendering no menu.
    return items.length > 0 ? items : defaultWebNavItems();
  } catch {
    return defaultWebNavItems();
  }
});

/** The generated defaults (core + manifests) — the no-CMS fallback menu. */
export function defaultWebNavItems(): NavMenuItem[] {
  return desiredNavItems()
    .filter((d) => d.platforms.includes("web"))
    .map((d) => ({ key: d.key, label: d.label, href: d.href, icon: d.icon }));
}
