import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
} from "@acme/ext-kit/server";
import { handleChannelMessage } from "@acme/ext-chat/server";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { SlackAdapterSettings } from "../payload/settings";
import { settings } from "../payload/settings";

/**
 * Slack Events-API webhook. Verifies the signing secret, answers the
 * url_verification challenge, and routes app_mention + DM messages through
 * ext-chat's handleChannelMessage(), replying via chat.postMessage. Responds
 * 200 quickly; Slack's at-least-once retries are deduped by event_id inside
 * handleChannelMessage. To swap in the official @chat-adapter/slack package,
 * hand the raw Request to its webhook handler here (same normalize → handle →
 * post shape).
 */

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  const ts = headers.get("x-slack-request-timestamp");
  const sig = headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  // Reject stale (>5 min) requests to blunt replay.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
  const base = `v0:${ts}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function postMessage(channel: string, text: string, threadTs?: string) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN ?? ""}`,
    },
    body: JSON.stringify({ channel, text, thread_ts: threadTs }),
  });
}

interface SlackEvent {
  type: string;
  text?: string;
  user?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  channel_type?: string;
  bot_id?: string;
  subtype?: string;
}

export const publicRoutes: ExtPublicRouteTable = {
  "POST /webhook": async (req, ctx: ExtPublicRouteContext) => {
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
      return json(503, { error: "Slack adapter not configured" });
    }
    const rawBody = await req.text();
    if (!verifySignature(rawBody, req.headers)) {
      return json(401, { error: "Bad signature" });
    }

    const payload = JSON.parse(rawBody) as {
      type?: string;
      challenge?: string;
      event?: SlackEvent;
      event_id?: string;
    };

    // 1. URL verification handshake.
    if (payload.type === "url_verification") {
      return Response.json({ challenge: payload.challenge });
    }

    const adapterSettings = await getExtensionSettings<SlackAdapterSettings>(
      await ctx.getPayload(),
      settings,
    );
    if (!adapterSettings.enabled) return Response.json({ ok: true });

    const event = payload.event;
    // 2. Only handle human mentions + DMs (ignore the bot's own + edits).
    const isDm = event?.type === "message" && event.channel_type === "im";
    const isMention = event?.type === "app_mention";
    if (
      !event ||
      event.bot_id ||
      event.subtype ||
      (!isDm && !isMention) ||
      !event.channel ||
      !event.user ||
      !event.text
    ) {
      return Response.json({ ok: true });
    }

    // Strip the leading bot mention (<@U123>) from the text.
    const text = event.text.replace(/<@[^>]+>\s*/g, "").trim();
    const threadTs = event.thread_ts ?? event.ts;

    try {
      const result = await handleChannelMessage(
        {
          channel: "slack",
          threadKey: `slack:${event.channel}:${threadTs}`,
          contactKey: `slack:${event.user}`,
          text,
          displayName: event.user,
          isGroup: !isDm,
          getPayload: ctx.getPayload,
        },
        payload.event_id,
      );
      if (result.replyText) {
        await postMessage(event.channel, result.replyText, threadTs);
      }
    } catch {
      // Swallow — Slack will retry; dedupe guards against double-replies.
    }

    return Response.json({ ok: true });
  },
};
