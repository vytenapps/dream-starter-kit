"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useChatThreads, useCreateThread, useDeleteThread } from "@acme/app";
import { toast } from "@acme/ui/toast";

import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";

export default function ChatPage() {
  const router = useRouter();
  const threads = useChatThreads();
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();

  async function onNew() {
    try {
      const thread = await createThread.mutateAsync(undefined);
      router.push(`/chat/${thread.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start chat");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <Button onClick={() => void onNew()} disabled={createThread.isPending}>
          New chat
        </Button>
      </div>

      {threads.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : threads.data && threads.data.length > 0 ? (
        <ul className="grid gap-2">
          {threads.data.map((thread) => (
            <li key={thread.id}>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    <Link href={`/chat/${thread.id}`} className="hover:underline">
                      {thread.title ?? "Untitled"}
                    </Link>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteThread.mutateAsync(thread.id)}
                  >
                    Delete
                  </Button>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          No chats yet — start one to talk to the assistant.
        </p>
      )}
    </main>
  );
}
