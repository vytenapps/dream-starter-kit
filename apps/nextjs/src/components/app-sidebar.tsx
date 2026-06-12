"use client";

import * as React from "react";
import { IconInnerShadowTop } from "@tabler/icons-react";

import { useSession } from "@acme/api";

import type { NavMenuItem } from "~/lib/ext/nav-types";
import { useBranding } from "~/components/branding-provider";
import { resolveNavIcon } from "~/components/nav-icons";
import { NavMain } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

export function AppSidebar({
  navItems,
  ...props
}: React.ComponentProps<typeof Sidebar> & { navItems: NavMenuItem[] }) {
  const { user } = useSession();
  const branding = useBranding();
  // The menu is CMS-driven (nav-items collection, staff-edited in /admin) and
  // resolved server-side by the (app) layout; icon names map through the
  // core + generated icon registry with a default fallback.
  const navMain = navItems.map((item) => ({
    title: item.label,
    url: item.href,
    icon: resolveNavIcon(item.icon),
  }));
  const sidebarUser = {
    name:
      (user?.user_metadata?.display_name as string | undefined) ??
      user?.email ??
      "User",
    email: user?.email ?? "",
    avatar: (user?.user_metadata?.avatar_url as string | undefined) ?? "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/a">
                {(branding.logoLightUrl ?? branding.logoDarkUrl) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoLightUrl ?? branding.logoDarkUrl ?? ""}
                      alt={branding.appName}
                      className="h-5 w-auto object-contain dark:hidden"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logoDarkUrl ?? branding.logoLightUrl ?? ""}
                      alt={branding.appName}
                      className="hidden h-5 w-auto object-contain dark:block"
                    />
                  </>
                ) : (
                  <>
                    <IconInnerShadowTop className="size-5!" />
                    <span className="text-base font-semibold">
                      {branding.appName}
                    </span>
                  </>
                )}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
