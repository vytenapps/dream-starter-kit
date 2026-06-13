"use client";

// KIT ADAPTATION (see VENDOR.md): upstream resumed dropped streams via
// redis-backed resumable-stream. The kit ships without redis, so this is a
// no-op that keeps the upstream signature (call-sites stay diff-free).
import type { UseChatHelpers } from "@ai-sdk/react";

import type { ChatMessage } from "../lib/types";

export type UseAutoResumeParams = {
  autoResume: boolean;
  initialMessages: ChatMessage[];
  resumeStream: UseChatHelpers<ChatMessage>["resumeStream"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
};

export function useAutoResume(_params: UseAutoResumeParams) {
  // Intentionally empty — resumable streams require a redis backend.
}
