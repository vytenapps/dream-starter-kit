"use client";

import { useEffect } from "react";

/**
 * Payload admin `beforeDashboard` gate — a FALLBACK for the seed flow.
 *
 * Seeding normally runs right after the founder's account is created: sign-up
 * routes them through `/welcome` → `/cms-setup`, which seeds before they ever
 * reach `/admin`. This gate covers the edge case where that was skipped (e.g.
 * the founder closed the setup tab, or seeding failed): if the CMS is still
 * unseeded when a staff user opens `/admin`, it sends them to `/cms-setup`.
 *
 * Self-disabling: once content exists the status check reports `seeded: true`
 * and this renders nothing, so returning admins are never redirected. Renders
 * no UI of its own (it lives inside Payload's design system, not Tailwind).
 */
export function SeedGate() {
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/cms/seed", {
          method: "GET",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { seeded?: boolean };
        if (!controller.signal.aborted && data.seeded === false) {
          window.location.assign("/cms-setup");
        }
      } catch {
        // Network/CMS hiccup (or unmount abort) — leave the dashboard as-is
        // rather than trapping the admin.
      }
    })();
    return () => controller.abort();
  }, []);

  return null;
}
