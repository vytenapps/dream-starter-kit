"use client";

import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconCreditCard,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconNotification,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";

import type { ThemeMode } from "@acme/ui/theme";
import { signOut } from "@acme/app";
import { cn } from "@acme/ui";
import { useTheme } from "@acme/ui/theme";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "~/components/ui/dropdown-menu";
import { createClient } from "~/lib/supabase/client";

export interface UserMenuUser {
  name: string;
  email: string;
  avatar: string;
}

/**
 * The signed-in user's account dropdown CONTENT — Account / Billing /
 * Notifications / Theme / Log out, with the avatar + name/email header. Shared
 * verbatim by the `/a` app sidebar (`nav-user.tsx`) and the public/catalog
 * headers (`header-user-menu.tsx`) so the two stay identical. Only the trigger
 * differs per caller; this owns everything inside the menu.
 *
 * The name/email column uses `flex flex-col` (NOT a `grid` utility): the catalog
 * page loads `ideas.css`, whose global `.grid` (the card grid) overrides
 * Tailwind's `grid` and would lay name + email into columns. Flex stacks them
 * reliably in every context.
 */
export function UserMenuContent({
  user,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  className,
  /** When set, navigate to this path after sign-out (e.g. the app sidebar →
   *  /sign-in). Omitted on public pages, which hard-reload and stay put. */
  signOutRedirect,
}: {
  user: UserMenuUser;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
  signOutRedirect?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { themeMode, resolvedTheme, setTheme } = useTheme();

  const themeOptions: {
    mode: ThemeMode;
    label: string;
    Icon: typeof IconSun;
  }[] = [
    { mode: "light", label: "Light", Icon: IconSun },
    { mode: "dark", label: "Dark", Icon: IconMoon },
    { mode: "auto", label: "System", Icon: IconDeviceDesktop },
  ];

  const initial = user.name.trim()[0]?.toUpperCase() || "★";

  return (
    <DropdownMenuContent
      className={cn("min-w-56 rounded-lg", className)}
      side={side}
      align={align}
      sideOffset={sideOffset}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            {user.email ? (
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            ) : null}
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <IconUserCircle />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/billing")}>
          <IconCreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/a/notifications")}>
          <IconNotification />
          Notifications
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {/* Reflects the RESOLVED theme (sun/moon) — in System mode it tracks
              the live light/dark, not a generic icon. */}
          {resolvedTheme === "dark" ? <IconMoon /> : <IconSun />}
          Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {themeOptions.map(({ mode, label, Icon }) => (
            <DropdownMenuItem key={mode} onClick={() => setTheme(mode)}>
              <Icon />
              {label}
              {themeMode === mode && <IconCheck className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          void signOut(supabase)
            .catch(() => {
              // `signOut` still throws if the server-side revoke fails, but it
              // now guarantees a local sign-out first (see @acme/app signOut), so
              // the session is genuinely cleared — proceed to reload anyway.
            })
            .finally(() => {
              // Hard navigation, NOT router.refresh(): a soft refresh can keep
              // serving the entitled (ungated) RSC that was cached/prefetched
              // while signed in, so premium content (e.g. a gated post/plan)
              // lingers after logout. A full document load discards the client
              // Router Cache and re-renders server-side with the cleared
              // session, re-evaluating access control.
              if (signOutRedirect) window.location.assign(signOutRedirect);
              else window.location.reload();
            })
        }
      >
        <IconLogout />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
