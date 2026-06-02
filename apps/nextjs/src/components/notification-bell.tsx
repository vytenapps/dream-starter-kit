"use client";

import Link from "next/link";
import { IconBell } from "@tabler/icons-react";

import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@acme/app";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/** Header notification bell: unread badge + a dropdown of recent notifications. */
export function NotificationBell() {
  const notifications = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const recent = notifications.data?.slice(0, 6) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <IconBell className="size-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <span className="text-muted-foreground text-xs">
              {unread} unread
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            No notifications
          </p>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5"
              onClick={() => {
                if (!n.read_at) void markRead.mutateAsync(n.id);
              }}
            >
              <span className={n.read_at ? "text-sm" : "text-sm font-medium"}>
                {n.title ?? n.type}
              </span>
              {n.body && (
                <span className="text-muted-foreground text-xs">{n.body}</span>
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications">View all</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
