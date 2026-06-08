"use client";

import Link from "next/link";

/**
 * Adds a "Theme" entry to the Payload admin nav (registered as
 * `admin.components.afterNavLinks`) linking to the custom editor view at
 * `/admin/theme`. Uses Payload's own `nav__link` class so it blends in.
 */
export function ThemeNavLink() {
  return (
    <Link className="nav__link" href="/admin/theme">
      <span className="nav__link-label">Theme</span>
    </Link>
  );
}
