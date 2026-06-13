"use client";

import "../vendor/styles.css";

import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { useSession } from "@acme/api";
import { Button } from "@acme/ui/button";

import { DataStreamProvider } from "../vendor/components/chat/data-stream-provider";
import { SidebarHistory } from "../vendor/components/chat/sidebar-history";
import { ChatShell } from "../vendor/components/chat/shell";
import { ActiveChatProvider } from "../vendor/hooks/use-active-chat";
import { CHAT_PATH } from "../vendor/lib/constants";

/**
 * The /a/chat surface: the vendored vercel/ai-chatbot interface (streaming,
 * artifacts, votes, attachments) inside the kit's app shell. The thread id
 * comes from the URL (use-active-chat parses CHAT_PATH), so the list page and
 * the [threadId] page render the same screen. History lives in an in-page
 * panel on lg+ and in a Sheet (see ChatHeader) on mobile.
 */
export function ChatScreen() {
  const { user } = useSession();
  const sessionUser = user ? { id: user.id } : null;

  return (
    <DataStreamProvider>
      <ActiveChatProvider>
        <div className="flex h-[calc(100dvh-var(--header-height)-1.5rem)] w-full flex-row overflow-hidden">
          <aside className="hidden w-60 shrink-0 flex-col border-r lg:flex">
            <div className="p-2">
              <Button asChild className="w-full" size="sm" variant="outline">
                <Link href={CHAT_PATH}>
                  <PlusIcon className="size-4" />
                  New chat
                </Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <SidebarHistory user={sessionUser} />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <ChatShell user={sessionUser} />
          </div>
        </div>
      </ActiveChatProvider>
    </DataStreamProvider>
  );
}
