import { defineExtensionSettings } from "@acme/ext-kit/payload";

/** Slack adapter settings — an on/off toggle. Tokens live in env (golden rule #3). */
export const settings = defineExtensionSettings({
  slug: "chat-adapter-slack",
  name: "Slack Adapter",
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
