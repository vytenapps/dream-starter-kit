"use client";

import { Button } from "@acme/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";

import { useReminders } from "../index";

/** Dashboard widget: upcoming (pending) reminders. */
export function RemindersWidget() {
  const reminders = useReminders();
  const pending =
    reminders.data?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardDescription>Reminders</CardDescription>
          <CardTitle className="text-xl">
            {reminders.isLoading
              ? "—"
              : pending === 0
                ? "Nothing scheduled"
                : `${pending} upcoming`}
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/x/reminders">Open</a>
        </Button>
      </CardHeader>
    </Card>
  );
}
