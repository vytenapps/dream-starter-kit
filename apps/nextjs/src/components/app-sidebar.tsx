"use client";

import * as React from "react";
import {
  IconBell,
  IconClock,
  IconDashboard,
  IconInnerShadowTop,
  IconMessageCircle,
} from "@tabler/icons-react";

import { useSession } from "@acme/api";
import { APP_NAME } from "@acme/config/constants";

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
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Chat", url: "/chat", icon: IconMessageCircle },
  { title: "Reminders", url: "/reminders", icon: IconClock },
  { title: "Notifications", url: "/notifications", icon: IconBell },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useSession();
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
              <a href="/dashboard">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">{APP_NAME}</span>
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
