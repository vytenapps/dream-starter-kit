import "server-only";

import { after } from "next/server";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
} from "@acme/ext-kit/server";
import { handleChannelMessage } from "@acme/ext-chat/server";
import { getAdapterSettings } from "@acme/ext-kit/payload";

import type { SlackAdapterSettings } from "../payload/settings";
import { settings } from "../payload/settings";

/**
 * Slack channel adapter, built on the Chat SDK (chat-sdk.dev). `createSlackAdapter()`
 * auto-detects SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET from env and owns the
 * Events-API webhook (signature verification, url_verification, dedupe). Our
 * onNewMention/onDirectMessage handlers run the shared bot brain
 * (handleChannelMessage) and reply via thread.post — which also persists the
 * turn into the unified ext_chat_threads/messages tables. Memory state keeps
 * the kit free of un-RLS'd SDK tables (golden rule #1); conversation memory
 * lives in our own tables, so cold-start subscription loss only means a Slack
 * follow-up needs a re-mention.
 */

function createBot() {
  const instance = new Chat({
    userName: "assistant",
    adapters: { slack: createSlackAdapter() },
    state: createMemoryState(),
  });

  const respond = async (
    thread: { id: string; post: (text: string) => Promise<unknown> },
    message: {
      text: string;
      author: { isMe: boolean; userId: string; fullName: string };
    },
  ) => {
    if (message.author.isMe || !message.text.trim()) return;
    const result = await handleChannelMessage({
      channel: "slack",
      threadKey: thread.id,
      contactKey: message.author.userId,
      text: message.text,
      displayName: message.author.fullName,
      isGroup: true,
    });
    if (result.replyText) await thread.post(result.replyText);
  };

  instance.onNewMention(respond);
  instance.onDirectMessage(respond);
  return instance;
}

let bot: ReturnType<typeof createBot> | null = null;
function getBot() {
  bot ??= createBot();
  return bot;
}

export const publicRoutes: ExtPublicRouteTable = {
  "POST /webhook": async (req, ctx: ExtPublicRouteContext) => {
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
      return Response.json(
        { error: "Slack adapter not configured" },
        { status: 503 },
      );
    }
    const adapterSettings = await getAdapterSettings<SlackAdapterSettings>(
      await ctx.getPayload(),
      settings,
    );
    if (!adapterSettings.enabled) return Response.json({ ok: true });

    // The SDK verifies the signature, answers url_verification, dedupes, and
    // dispatches to our handlers; waitUntil keeps the webhook ack fast.
    return getBot().webhooks.slack(req, {
      waitUntil: (task) => after(() => task),
    });
  },
};
