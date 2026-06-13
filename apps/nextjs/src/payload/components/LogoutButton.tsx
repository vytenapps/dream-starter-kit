"use client";

import { useState } from "react";

import { signOut } from "@acme/app";

import { createClient } from "~/lib/supabase/client";

/**
 * Custom Payload admin logout button (`admin.components.logout.Button`).
 *
 * CMS auth is SSO from the Supabase session — Payload's local strategy is OFF and
 * there is no `payload-token`. So Payload's default logout (which clears that
 * non-existent cookie and bounces around `/admin`) would leave the Supabase
 * session intact and the user effectively still signed in. This instead ends the
 * Supabase session and sends the user to the host root (`/`).
 *
 * Styling mirrors the nav Hamburger/collapse toggle at the top of the sidebar:
 * the same bordered, rounded box + hover treatment and a 1px icon stroke
 * (`$style-stroke-width-s`, what the menu/chevron icons use) rather than
 * Payload's heavier 2px `icon--logout` glyph. The icon container mirrors the
 * `hamburger__*-icon` element. See the `.nav-logout` rules in
 * `app/(payload)/custom.css`.
 */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut(createClient());
    } catch {
      // Best-effort: supabase-js clears the local session before the network
      // revoke, so navigate away regardless rather than trapping the user.
    } finally {
      // Hard navigation out of the Payload admin SPA back to the host root.
      window.location.assign("/");
    }
  };

  return (
    <button
      aria-label="Log out"
      className="nav__log-out nav-logout"
      disabled={busy}
      onClick={() => void handleLogout()}
      tabIndex={0}
      title="Log out"
      type="button"
    >
      <div className="nav-logout__icon">
        <svg
          className="icon"
          fill="none"
          height="20"
          viewBox="0 0 20 20"
          width="20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="stroke"
            d="M12 16H14.6667C15.0203 16 15.3594 15.8595 15.6095 15.6095C15.8595 15.3594 16 15.0203 16 14.6667V5.33333C16 4.97971 15.8595 4.64057 15.6095 4.39052C15.3594 4.14048 15.0203 4 14.6667 4H12M7.33333 13.3333L4 10M4 10L7.33333 6.66667M4 10H12"
            strokeLinecap="square"
          />
        </svg>
      </div>
    </button>
  );
}
