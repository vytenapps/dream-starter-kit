import { defineAdapterSettings } from "@acme/ext-kit/payload";

/**
 * Sendblue adapter settings — toggle + daily outbound quota, contributed as a
 * tab to the one "AI Chat Settings" screen (target: chat) rather than a
 * standalone global. Tokens live in env (golden rule #3).
 */
export const settings = defineAdapterSettings({
  slug: "chat-adapter-sendblue",
  name: "Sendblue",
  target: "chat",
  description: "Answer over iMessage/SMS with the AI chat bot brain.",
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Process Sendblue webhooks. Requires SENDBLUE_API_KEY/SECRET/FROM_NUMBER.",
      },
    },
    {
      name: "dailyOutboundQuota",
      type: "number",
      defaultValue: 200,
      admin: {
        description:
          "Max outbound messages per from-number per day (0 = unlimited).",
      },
    },
  ],
});

export interface SendblueAdapterSettings extends Record<string, unknown> {
  enabled: boolean;
  dailyOutboundQuota: number;
}
