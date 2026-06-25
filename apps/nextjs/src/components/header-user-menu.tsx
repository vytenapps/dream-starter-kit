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
import { useTheme } from "@acme/ui/theme";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { createClient } from "~/lib/supabase/client";

export interface HeaderUser {
  name: string;
  email: string;
  avatar: string;
}

/**
 * The signed-in user's avatar + account dropdown for the catalog header. Mirrors
 * the account menu at the bottom of the `/a` app sidebar (see `nav-user.tsx`) —
 * Account / Billing / Notifications / Theme / Log out — but with a compact avatar
 * trigger instead of the sidebar's full-width button. Rendered in place of the
 * "Get unlimited access" CTA once the visitor is signed in (catalog-header.tsx).
 */
export function HeaderUserMenu({ user }: { user: HeaderUser }) {
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
      <DropdownMenuContent
        // Width matches the /a app sidebar's account dropdown (nav-user): the
        // sidebar is `--sidebar-width` (calc(spacing*72) = 288px) less the inset
        // + footer padding (p-2 each), so its trigger-width dropdown renders at
        // ~256px = w-64. Fixed here (not min-w) so it doesn't stretch with the
        // small avatar trigger.
        className="w-64 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8">
              <AvatarImage src={user.avatar} alt="" />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
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
            void signOut(supabase).then(() => {
              // Stay on the public catalog; the auth-state change flips the
              // header back to the CTA. refresh() drops any server-rendered
              // signed-in state.
              router.refresh();
            })
          }
        >
          <IconLogout />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
