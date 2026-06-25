"use client";

import type { UserMenuUser } from "~/components/user-menu-content";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { UserMenuContent } from "~/components/user-menu-content";

export type HeaderUser = UserMenuUser;

/**
 * The signed-in user's avatar + account dropdown for the site headers (catalog +
 * marketing). A compact avatar trigger over the shared `UserMenuContent` — the
 * exact same menu as the `/a` app sidebar (`nav-user.tsx`). Rendered in place of
 * the "Get unlimited access" / Sign in CTA once the visitor is signed in.
 */
export function HeaderUserMenu({ user }: { user: HeaderUser }) {
  const initial = user.name.trim()[0]?.toUpperCase() || "★";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
        >
          <Avatar className="size-9">
            <AvatarImage src={user.avatar} alt="" />
            <AvatarFallback className="text-sm">{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      {/* w-64 (256px) matches the /a sidebar account dropdown's rendered width. */}
      <UserMenuContent user={user} side="bottom" align="end" className="w-64" />
    </DropdownMenu>
  );
}
