"use client";

import * as React from "react";
import {
  IconBell,
  IconClock,
  IconCreditCard,
  IconDashboard,
  IconInnerShadowTop,
  IconMessageCircle,
} from "@tabler/icons-react";

import { useSession } from "@acme/api";

import { useBranding } from "~/components/branding-provider";
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

const navMain = [
  { title: "Dashboard", url: "/a", icon: IconDashboard },
  { title: "Chat", url: "/chat", icon: IconMessageCircle },
  { title: "Reminders", url: "/reminders", icon: IconClock },
  { title: "Notifications", url: "/notifications", icon: IconBell },
  { title: "Billing", url: "/billing", icon: IconCreditCard },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useSession();
  const branding = useBranding();
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
