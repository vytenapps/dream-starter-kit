import "server-only";

import { hasExtension } from "~/ext/registry.client.generated";

/**
 * Runtime enable/disable gate (docs/EXTENSIONS-PLAN.md §2.5). An extension is
 * enabled when it's installed (in the generated registry) and its
 * `kit-extensions` row hasn't been toggled off in /admin.
 *
 * The disabled set is read via the Local API with a short in-memory cache
 * (per serverless instance) so the API dispatcher and generated stub layouts
 * don't pay a CMS read per request. Rows are created enabled by the boot
 * reconcile; a missing row or an unreachable CMS therefore reads as ENABLED —
 * degrading open matches every other CMS reader in the kit (lib/payload.ts).
 */
const CACHE_MS = 30_000;

let cached: { at: number; disabled: Set<string> } | null = null;

async function disabledExtensions(): Promise<Set<string>> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.disabled;
  try {
    const [{ default: config }, { getPayload }] = await Promise.all([
      import("@payload-config"),
      import("payload"),
    ]);
    const payload = await getPayload({ config });
    const res = await payload.find({
      collection: "kit-extensions",
      where: { enabled: { equals: false } },
      pagination: false,
      overrideAccess: true,
    });
    cached = { at: now, disabled: new Set(res.docs.map((d) => d.slug)) };
  } catch {
    cached = { at: now, disabled: new Set() };
  }
  return cached.disabled;
}

export async function isExtensionEnabled(slug: string): Promise<boolean> {
  if (!hasExtension(slug)) return false;
  return !(await disabledExtensions()).has(slug);
}

/** The runtime-disabled extension slugs (for widget/menu filtering). */
export async function disabledExtensionSlugs(): Promise<string[]> {
  return [...(await disabledExtensions())];
}

/** Test seam: drop the in-memory cache. */
export function resetEnabledCache(): void {
  cached = null;
}
