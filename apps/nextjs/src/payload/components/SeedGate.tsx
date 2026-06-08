"use client";

import { useEffect } from "react";

/**
 * Payload admin `beforeDashboard` gate. When the CMS has no content yet (i.e.
 * right after the first admin is created), it sends the admin to `/cms-setup`,
 * which seeds demo content with a progress bar and returns them to `/admin`.
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
