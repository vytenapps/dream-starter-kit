"use client";

import { useSession } from "@acme/api";
import { isAnonymousUser, useProfile } from "@acme/app";

import type { NavbarActionProps } from "~/components/launch-ui/sections/navbar";
import { HeaderUserMenu } from "~/components/header-user-menu";
import { Button } from "~/components/launch-ui/ui/button";

/**
 * Auth-aware right side for the marketing `PublicHeader`. When a real
 * (non-anonymous) user is signed in it shows the shared account avatar dropdown
 * (the same menu as the `/a` sidebar and the catalog header); otherwise it
 * renders the configured header actions (Sign in / CTA) exactly as the Navbar
 * does. SSR + the first client render both show the actions (session loads in an
 * effect), so signed-in users see a brief actions → avatar swap with no
 * hydration mismatch — consistent with the catalog header.
 */
export function PublicHeaderUser({
  actions,
}: {
  actions: NavbarActionProps[];
}) {
  const { user } = useSession();
  const isLoggedIn = !!user && !isAnonymousUser(user);
  const profile = useProfile();

  if (isLoggedIn) {
    return (
      <HeaderUserMenu
        user={{
          name: profile.data?.display_name?.trim() ?? user?.email ?? "Member",
          email: user?.email ?? "",
          avatar: profile.data?.avatar_url ?? "",
        }}
      />
    );
  }

  return (
    <>
      {actions.map((action) =>
        action.isButton ? (
          <Button
            key={`${action.href}-${action.text}`}
            variant={action.variant ?? "default"}
            asChild
          >
            <a href={action.href}>
              {action.icon}
              {action.text}
              {action.iconRight}
            </a>
          </Button>
        ) : (
          <a
            key={`${action.href}-${action.text}`}
            href={action.href}
            className="hidden text-sm md:block"
          >
            {action.text}
          </a>
        ),
      )}
    </>
  );
}
