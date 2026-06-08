"use client";

import { useMarkNotificationRead, useNotifications } from "@acme/app";
import { cn } from "@acme/ui";

import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";

export default function NotificationsPage() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      {notifications.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : notifications.data && notifications.data.length > 0 ? (
        <ul className="grid gap-2">
          {notifications.data.map((n) => (
            <li key={n.id}>
              <Card className={cn(!n.read_at && "border-primary/40")}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">
                      {n.title ?? n.type}
                    </CardTitle>
                    {n.body && (
                      <p className="text-muted-foreground text-sm">{n.body}</p>
                    )}
                  </div>
                  {!n.read_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void markRead.mutateAsync(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No notifications yet.</p>
      )}
    </div>
  );
}
