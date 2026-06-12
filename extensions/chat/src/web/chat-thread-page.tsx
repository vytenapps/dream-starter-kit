"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { toast } from "@acme/ui/toast";

import { useSendMessage, useThreadMessages } from "../index";

export function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const messages = useThreadMessages(threadId);
  const send = useSendMessage(threadId);
  const [input, setInput] = useState("");

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await send.mutateAsync(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message failed");
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col p-4">
      <Link href="/x/chat" className="text-muted-foreground text-sm">
        ← Chats
      </Link>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.data?.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={cn(
                "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              {m.content}
            </span>
          </div>
        ))}
        {send.isPending && (
          <p className="text-muted-foreground text-sm">
            Assistant is thinking…
          </p>
        )}
        {messages.data?.length === 0 && !send.isPending && (
          <p className="text-muted-foreground text-sm">
            Say hello to start the conversation.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => void onSend(e)}
        className="flex gap-2 border-t pt-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the assistant…"
          disabled={send.isPending}
        />
        <Button type="submit" disabled={send.isPending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
