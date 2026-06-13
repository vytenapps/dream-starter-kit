"use client";

import { ChatScreen } from "./chat-screen";

/** /a/chat/[threadId] — the id is read from the URL by use-active-chat. */
export function ChatThreadPage() {
  return <ChatScreen />;
}
