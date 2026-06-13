import {
  CHAT_CHANNELS,
  CHAT_MODELS,
  DEFAULT_TRANSCRIPTION_MODEL,
  ROUTING_AI_MODEL,
} from "@acme/config";
import { defineExtensionSettings } from "@acme/ext-kit/payload";

/**
 * Runtime-tunable chat settings — edited by admins in /admin under the
 * Extensions group, read by the server (stream route + bot brain) via
 * getExtensionSettings with these defaults applied. Organized as tabs:
 * General · Universal Prompt · Skills · Routing · Transcription. The MODEL ID
 * stays centralized in @acme/config (golden rule #5); secrets stay in the zod
 * env schema (golden rule #3).
 */
export const settings = defineExtensionSettings({
  slug: "chat",
  name: "AI Chat",
  // Own admin nav group so the settings screen, the Chat Skills collection, and
  // the adapter tabs all cluster under "AI Chat".
  group: "AI Chat",
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "General",
          description: "Conversation basics.",
          fields: [
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
        },
        {
          label: "Universal Prompt",
          description:
            "The always-applied base prompt, plus optional channel-scoped " +
            "sub-prompts appended for matching channels.",
          fields: [
            {
              name: "universalPrompt",
              type: "textarea",
              defaultValue:
                "You are a concise, friendly assistant inside the Dream app.",
              admin: {
                description:
                  "Applied to every conversation across every channel.",
              },
            },
            {
              name: "channelPrompts",
              type: "array",
              labels: {
                singular: "Channel sub-prompt",
                plural: "Channel sub-prompts",
              },
              admin: {
                description:
                  "Appended to the universal prompt only on the selected " +
                  "channels. Leave channels empty to apply everywhere.",
              },
              fields: [
                { name: "label", type: "text" },
                {
                  name: "channels",
                  type: "select",
                  hasMany: true,
                  options: CHAT_CHANNELS.map((c) => ({ label: c, value: c })),
                },
                { name: "prompt", type: "textarea", required: true },
              ],
            },
          ],
        },
        {
          label: "Skills",
          description:
            "Routable personas live in the Chat Skills collection; this " +
            "toggle turns skill routing on or off.",
          fields: [
            {
              name: "skillsFeatureEnabled",
              type: "checkbox",
              defaultValue: false,
              label: "Enable skill routing",
              admin: {
                description:
                  "When on, each message is routed to a matching skill " +
                  "persona (manage them under Extensions → Chat Skills).",
              },
            },
          ],
        },
        {
          label: "Routing",
          description: "How the bot brain selects a skill per message.",
          fields: [
            {
              name: "keywordThreshold",
              type: "number",
              defaultValue: 0.6,
              admin: {
                description:
                  "Minimum keyword score to route to a skill before the LLM " +
                  "fallback is considered.",
              },
            },
            {
              name: "useLlmFallback",
              type: "checkbox",
              defaultValue: true,
              admin: {
                description:
                  "When keyword routing is inconclusive, ask a small model " +
                  "to classify among the top candidates.",
              },
            },
            {
              name: "llmFallbackModel",
              type: "select",
              defaultValue: ROUTING_AI_MODEL,
              options: CHAT_MODELS.map((m) => ({
                label: m.name,
                value: m.id,
              })),
            },
            {
              name: "stickinessTurns",
              type: "number",
              defaultValue: 2,
              admin: {
                description:
                  "Turns an active skill stays selected before re-routing.",
              },
            },
          ],
        },
        {
          label: "Transcription",
          description: "Voice-message transcription for the chat input.",
          fields: [
            {
              name: "transcriptionEnabled",
              type: "checkbox",
              defaultValue: false,
              label: "Enable voice input",
            },
            {
              name: "transcriptionModel",
              type: "text",
              defaultValue: DEFAULT_TRANSCRIPTION_MODEL,
              admin: {
                description:
                  'A "provider/model" id. Only openai/* is wired up ' +
                  "(needs OPENAI_API_KEY).",
              },
            },
            {
              name: "maxAudioMB",
              type: "number",
              defaultValue: 25,
              admin: { description: "Max upload size for a voice clip." },
            },
          ],
        },
      ],
    },
  ],
});

export interface ChannelPrompt {
  label?: string | null;
  channels?: string[] | null;
  prompt: string;
}

export interface ChatSettings extends Record<string, unknown> {
  maxHistoryMessages: number;
  universalPrompt: string;
  channelPrompts?: ChannelPrompt[] | null;
  skillsFeatureEnabled: boolean;
  keywordThreshold: number;
  useLlmFallback: boolean;
  llmFallbackModel: string;
  stickinessTurns: number;
  transcriptionEnabled: boolean;
  transcriptionModel: string;
  maxAudioMB: number;
}
