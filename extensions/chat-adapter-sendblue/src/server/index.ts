import "server-only";

import { after } from "next/server";
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";
import { createSendblueAdapter } from "chat-adapter-sendblue";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
} from "@acme/ext-kit/server";
import { handleChannelMessage, transcribeAudio } from "@acme/ext-chat/server";
import { getAdapterSettings } from "@acme/ext-kit/payload";

import type { SendblueAdapterSettings } from "../payload/settings";
import { settings } from "../payload/settings";

/**
 * Sendblue (iMessage/SMS) channel adapter, built on the Chat SDK
 * (chat-sdk.dev/adapters/community/sendblue). `createSendblueAdapter()` reads
 * SENDBLUE_API_KEY / SENDBLUE_API_SECRET / SENDBLUE_FROM_NUMBER / webhook
 * secret from env and owns the inbound webhook (verification, dedupe, voice-
 * memo handling). Our handler runs the shared bot brain (handleChannelMessage
 * — STOP/HELP compliance, daily quota, skills, unified-thread persistence) and
 * replies via thread.post (the adapter strips markdown for iMessage). Memory
 * state avoids un-RLS'd SDK tables (golden rule #1); conversation memory lives
 * in our own ext_chat_* tables.
 */

function createBot(dailyQuota: number) {
  const instance = new Chat({
    userName: "assistant",
    adapters: { sendblue: createSendblueAdapter() },
    state: createMemoryState(),
  });

  const respond = async (
    thread: { id: string; post: (text: string) => Promise<unknown> },
    message: {
      text: string;
      author: { isMe: boolean; userId: string; fullName: string };
      attachments?: {
        type: string;
        fetchData?: () => Promise<Buffer>;
      }[];
    },
  ) => {
    if (message.author.isMe) return;

    let text = message.text.trim();
    // Voice memo → transcription (when OPENAI_API_KEY is set).
    if (!text && process.env.OPENAI_API_KEY) {
      const audio = message.attachments?.find((a) => a.type === "audio");
      if (audio?.fetchData) {
        try {
          const buf = await audio.fetchData();
          text = (
            await transcribeAudio(new Uint8Array(buf), "openai/whisper-1")
          ).trim();
        } catch {
          /* fall through — no text */
        }
      }
    }
    if (!text) return;

    const result = await handleChannelMessage({
      channel: "sms-sendblue",
      threadKey: thread.id,
      contactKey: message.author.userId,
      text,
      displayName: message.author.fullName,
      quotaKey: process.env.SENDBLUE_FROM_NUMBER,
      dailyQuota,
    });
    if (result.replyText) await thread.post(result.replyText);
  };

  instance.onNewMention(respond);
  instance.onDirectMessage(respond);
  return instance;
}

let bot: ReturnType<typeof createBot> | null = null;
function getBot(dailyQuota: number) {
  bot ??= createBot(dailyQuota);
  return bot;
}

export const publicRoutes: ExtPublicRouteTable = {
  "POST /webhook": async (req, ctx: ExtPublicRouteContext) => {
    if (!process.env.SENDBLUE_API_KEY || !process.env.SENDBLUE_FROM_NUMBER) {
      return Response.json(
        { error: "Sendblue adapter not configured" },
        { status: 503 },
      );
    }
    const adapterSettings = await getAdapterSettings<SendblueAdapterSettings>(
      await ctx.getPayload(),
      settings,
    );
    if (!adapterSettings.enabled) return Response.json({ ok: true });

    return getBot(adapterSettings.dailyOutboundQuota).webhooks.sendblue(req, {
      waitUntil: (task) => after(() => task),
    });
  },
};
