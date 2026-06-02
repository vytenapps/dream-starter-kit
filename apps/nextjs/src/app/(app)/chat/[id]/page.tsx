"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useSendMessage, useThreadMessages } from "@acme/app";
import { cn } from "@acme/ui";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const messages = useThreadMessages(id);
  const send = useSendMessage(id);
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
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <Link href="/chat" className="text-muted-foreground text-sm">
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
    </main>
  );
}
