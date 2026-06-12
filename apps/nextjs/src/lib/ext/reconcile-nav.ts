import type { Payload } from "payload";

import { extInstalled, extNavDefaults } from "~/ext/registry.client.generated";
import { CORE_NAV_ITEMS } from "./core-nav";

/**
 * Boot-time reconcile of the CMS-driven menu + extension registry
 * (docs/EXTENSIONS-PLAN.md §2.5). Diffs the GENERATED defaults (core nav +
 * manifest nav, baked into the registries at sync time) against the
 * `kit-extensions` and `nav-items` collections:
 *
 *   - inserts rows for newly installed extensions (enabled, manifest defaults),
 *   - updates framework-owned read-only fields (name/version/system, href),
 *   - deletes rows whose extension (or core entry) was removed,
 *   - NEVER overwrites staff edits — label/icon/platforms/enabled/order are
 *     written only on row creation.
 *
 * Invoked from instrumentation.ts after the Payload warm-up (so "merge the
 * install PR → deploy → menu row exists" needs zero manual steps) and as a CMS
 * seed step for local `pnpm db:reset`. Idempotent; safe under concurrent cold
 * starts (unique keys make duplicate creates fail quietly).
 */

interface DesiredNavItem {
  key: string;
  label: string;
  href: string;
  icon?: string;
  order: number;
  platforms: ("web" | "native")[];
  /** Extension slug — undefined for core entries. */
  extension?: string;
}

/** Merge an extension's web + native nav defaults into per-href menu rows. */
export function desiredNavItems(): DesiredNavItem[] {
  const items: DesiredNavItem[] = CORE_NAV_ITEMS.map((c) => ({ ...c }));

  const byKey = new Map<string, DesiredNavItem>();
  for (const [platform, entries] of [
    ["web", extNavDefaults.web],
    ["native", extNavDefaults.native],
  ] as const) {
    for (const entry of entries) {
      const key = `ext:${entry.extension}:${entry.href}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.platforms.includes(platform))
          existing.platforms.push(platform);
        continue;
      }
      const item: DesiredNavItem = {
        key,
        label: entry.title,
        href: entry.href,
        icon: entry.icon,
        order: entry.order,
        platforms: [platform],
        extension: entry.extension,
      };
      byKey.set(key, item);
      items.push(item);
    }
  }

  return items.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export async function reconcileExtensions(payload: Payload): Promise<void> {
  // --- kit-extensions rows -------------------------------------------------
  const existingExts = await payload.find({
    collection: "kit-extensions",
    pagination: false,
    overrideAccess: true,
  });
  const extRowBySlug = new Map(existingExts.docs.map((d) => [d.slug, d]));

  for (const ext of extInstalled) {
    const row = extRowBySlug.get(ext.slug);
    if (!row) {
      const created = await payload.create({
        collection: "kit-extensions",
        data: {
          slug: ext.slug,
          name: ext.name,
          version: ext.version,
          system: ext.system,
          enabled: true,
        },
        overrideAccess: true,
      });
      extRowBySlug.set(ext.slug, created);
    } else if (
      row.version !== ext.version ||
      row.name !== ext.name ||
      row.system !== ext.system
    ) {
      // Framework-owned metadata only — `enabled` is staff-owned.
      const updated = await payload.update({
        collection: "kit-extensions",
        id: row.id,
        data: { version: ext.version, name: ext.name, system: ext.system },
        overrideAccess: true,
      });
      extRowBySlug.set(ext.slug, updated);
    }
  }
  for (const row of existingExts.docs) {
    if (!extInstalled.some((e) => e.slug === row.slug)) {
      await payload.delete({
        collection: "kit-extensions",
        id: row.id,
        overrideAccess: true,
      });
      extRowBySlug.delete(row.slug);
    }
  }

  // --- nav-items rows ------------------------------------------------------
  const desired = desiredNavItems();
  const desiredByKey = new Map(desired.map((d) => [d.key, d]));
  const existingNav = await payload.find({
    collection: "nav-items",
    pagination: false,
    overrideAccess: true,
  });
  const navByKey = new Map(existingNav.docs.map((d) => [d.key, d]));

  for (const row of existingNav.docs) {
    if (!desiredByKey.has(row.key)) {
      await payload.delete({
        collection: "nav-items",
        id: row.id,
        overrideAccess: true,
      });
    }
  }

  // Create missing rows in menu order so Payload's drag-order (_order) starts
  // out matching the intended default order.
  for (const item of desired) {
    if (navByKey.has(item.key)) continue;
    const extRowId = item.extension
      ? extRowBySlug.get(item.extension)?.id
      : undefined;
    try {
      await payload.create({
        collection: "nav-items",
        data: {
          key: item.key,
          label: item.label,
          href: item.href,
          icon: item.icon,
          platforms: item.platforms,
          enabled: true,
          ...(extRowId !== undefined ? { extension: extRowId } : {}),
        },
        overrideAccess: true,
      });
    } catch (err) {
      // Unique-key violation = a concurrent cold start created it first. Fine.
      payload.logger.debug(
        { err, key: item.key },
        "nav-items reconcile: create raced",
      );
    }
  }
}
