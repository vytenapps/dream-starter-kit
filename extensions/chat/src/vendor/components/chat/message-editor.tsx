"use client";

// KIT ADAPTATION (see VENDOR.md): upstream called a "use server" action;
// the kit deletes trailing messages through the extension's authed route.

import type { UseChatHelpers } from "@ai-sdk/react";
import { API_BASE } from "../../lib/constants";
import type { ChatMessage } from "../../lib/types";

export async function submitEditedMessage({
  message,
  text,
  setMessages,
  regenerate,
}: {
  message: ChatMessage;
  text: string;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
}) {
  await fetch(`${API_BASE}/messages?messageId=${message.id}`, {
    method: "DELETE",
  });

  setMessages((messages) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return messages;
    }

    return [
      ...messages.slice(0, index),
      { ...message, parts: [{ type: "text" as const, text }] },
    ];
  });

  regenerate();
}
