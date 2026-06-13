"use client";

// KIT ADAPTATION (see VENDOR.md): public chat sharing is out of scope this
// phase — every chat is private. The hook keeps its upstream signature so
// call-sites stay diff-free; setVisibilityType is a no-op.
import type { VisibilityType } from "../components/chat/visibility-selector";

export function useChatVisibility(_args: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  return {
    visibilityType: "private" as VisibilityType,
    setVisibilityType: (_v: VisibilityType) => undefined,
  };
}
