"use client";

import { Button } from "@acme/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";

import { useUnreadCount } from "../index";

/** Dashboard widget: unread notification count. */
export function NotificationsWidget() {
  const unread = useUnreadCount();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardDescription>Notifications</CardDescription>
          <CardTitle className="text-xl">
            {unread === 0 ? "All caught up" : `${unread} unread`}
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/x/notifications">Open</a>
        </Button>
      </CardHeader>
    </Card>
  );
}
