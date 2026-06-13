"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSettings } from "@tabler/icons-react";

import { NotificationBell } from "@acme/ext-notifications/web";
import { Button } from "@acme/ui/button";

import type { NavMenuItem } from "~/lib/ext/nav-types";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { hasExtension } from "~/ext/registry.client.generated";

/** Authenticated pages that aren't menu entries (so can't be titled from nav). */
const FALLBACK_TITLES: Record<string, string> = {
  profile: "Profile",
};

export function SiteHeader({
  navItems,
  isStaff = false,
}: {
  navItems: NavMenuItem[];
  isStaff?: boolean;
}) {
  const pathname = usePathname();
  // Title comes from the CMS-driven menu (longest matching href wins), so
  // staff renames in /admin flow into the header too.
  const match = navItems
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  const segment = pathname.split("/").find(Boolean) ?? "";
  const title = match?.label ?? FALLBACK_TITLES[segment] ?? "Dashboard";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* The bell is the notifications extension's surface. If you remove
              that extension (not just disable it), delete this gated block —
              app-shell chrome is the one host edit `ext remove` can't do. */}
          {hasExtension("notifications") && <NotificationBell />}
          {/* Staff/admin shortcut into the Payload CMS admin. */}
          {isStaff && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="CMS settings"
            >
              <Link href="/admin">
                <IconSettings className="size-5" />
              </Link>
            </Button>
          )}
          {/* Theme switch lives in the sidebar user menu (see nav-user.tsx). */}
        </div>
      </div>
    </header>
  );
}
