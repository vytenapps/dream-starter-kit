import { defineExtensionSettings } from "@acme/ext-kit/payload";

/** Sendblue adapter settings — toggle + daily outbound quota. Tokens live in
 * env (golden rule #3). */
export const settings = defineExtensionSettings({
  slug: "chat-adapter-sendblue",
  name: "Sendblue Adapter",
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
