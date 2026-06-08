"use client";

import { usePathname } from "next/navigation";

import { NotificationBell } from "~/components/notification-bell";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

/** Section label shown in the header, keyed by the active route's first segment.
 *  Add an entry here when you add a top-level authenticated page. */
const SECTION_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  chat: "Chat",
  reminders: "Reminders",
  notifications: "Notifications",
  profile: "Profile",
};

export function SiteHeader() {
  const pathname = usePathname();
  const segment = pathname.split("/").find(Boolean) ?? "";
  const title = SECTION_TITLES[segment] ?? "Dashboard";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
