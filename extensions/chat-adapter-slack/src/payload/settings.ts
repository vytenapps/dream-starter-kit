import { defineAdapterSettings } from "@acme/ext-kit/payload";

/**
 * Slack adapter settings — an on/off toggle, contributed as a tab to the one
 * "AI Chat Settings" screen (target: chat) rather than a standalone global.
 * Tokens live in env (golden rule #3).
 */
export const settings = defineAdapterSettings({
  slug: "chat-adapter-slack",
  name: "Slack",
  target: "chat",
  description: "Answer in Slack with the AI chat bot brain.",
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Process Slack events. Requires SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET.",
      },
    },
  ],
});

export interface SlackAdapterSettings extends Record<string, unknown> {
  enabled: boolean;
}
