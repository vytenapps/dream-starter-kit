"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { motion } from "motion/react";

import type { ChatMessage } from "../../lib/types";
import type { VisibilityType } from "./visibility-selector";
import { CHAT_PATH, suggestions } from "../../lib/constants";
import { Suggestion } from "../ai-elements/suggestion";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestedActions = suggestions;

  return (
    <div
      className="flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-w-[200px] shrink-0 sm:min-w-0 sm:shrink"
          exit={{ opacity: 0, y: 16 }}
          initial={{ opacity: 0, y: 16 }}
          key={suggestedAction}
          transition={{
            delay: 0.06 * index,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suggestion
            className="border-border/50 bg-card/30 text-muted-foreground hover:bg-card/60 hover:text-foreground h-auto w-full rounded-xl border px-4 py-3 text-left text-[12px] leading-relaxed whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:p-4 sm:text-[13px] sm:whitespace-normal"
            onClick={(suggestion) => {
              window.history.pushState({}, "", `${CHAT_PATH}/${chatId}`);
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  },
);
