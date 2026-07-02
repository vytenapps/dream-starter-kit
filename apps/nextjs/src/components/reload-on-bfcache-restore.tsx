"use client";

import { useEffect } from "react";

/**
 * Force a server round-trip when a page is restored from the browser's
 * back/forward cache (bfcache). After logout the kit hard-navigates so the
 * server re-renders with the cleared session, but pressing **Back** can restore
 * the previously rendered — and previously entitled — document straight from
 * bfcache with no server hit, leaving gated content (app shell, premium post
 * body) readable to the next person on a shared machine.
 *
 * `pageshow` with `event.persisted === true` fires only on a bfcache restore, so
 * reloading there re-evaluates auth/entitlement without penalizing normal
 * navigation. Mounted on the gated surfaces (the authenticated app shell + the
 * premium content gate).
 */
export function ReloadOnBfcacheRestore() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}
