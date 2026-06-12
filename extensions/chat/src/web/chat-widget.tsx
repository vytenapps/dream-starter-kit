"use client";

import { Button } from "@acme/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@acme/ui/card";

import { useChatThreads } from "../index";

/** Dashboard widget: recent chats. */
export function ChatWidget() {
  const threads = useChatThreads();
  const count = threads.data?.length ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardDescription>AI Chat</CardDescription>
          <CardTitle className="text-xl">
            {threads.isLoading
              ? "—"
              : count === 0
                ? "Start a chat"
                : `${count} thread${count === 1 ? "" : "s"}`}
          </CardTitle>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/x/chat">Open</a>
        </Button>
      </CardHeader>
    </Card>
  );
}
