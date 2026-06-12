import { defineExtensionSettings } from "@acme/ext-kit/payload";

/**
 * Runtime-tunable chat settings — edited by admins in /admin under the
 * Extensions group, read by the stream route via getExtensionSettings (with
 * these defaults applied before the screen is ever saved). The MODEL ID is
 * deliberately NOT here: it stays centralized in @acme/config
 * (DEFAULT_AI_MODEL, golden rule #5). Secrets (the gateway key) stay in the
 * zod env schema (golden rule #3).
 */
export const settings = defineExtensionSettings({
  slug: "chat",
  name: "AI Chat",
  fields: [
    {
      name: "systemPrompt",
      type: "textarea",
      defaultValue:
        "You are a concise, friendly assistant inside the Dream app.",
      admin: {
        description: "The assistant's system prompt.",
      },
    },
    {
      name: "maxHistoryMessages",
      type: "number",
      min: 1,
      max: 200,
      defaultValue: 20,
      admin: {
        description:
          "How many prior messages of a thread are sent to the model.",
      },
    },
  ],
});

export interface ChatSettings extends Record<string, unknown> {
  systemPrompt: string;
  maxHistoryMessages: number;
}
