import "server-only";

import { timingSafeEqual } from "node:crypto";

import type {
  ExtPublicRouteContext,
  ExtPublicRouteTable,
} from "@acme/ext-kit/server";
import { handleChannelMessage } from "@acme/ext-chat/server";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { SendblueAdapterSettings } from "../payload/settings";
import { settings } from "../payload/settings";

/**
 * Sendblue (iMessage/SMS) inbound webhook. Verifies the shared webhook secret,
 * normalizes the inbound message (transcribing voice memos), routes it through
 * ext-chat's handleChannelMessage() — which applies STOP/HELP compliance + the
 * daily quota — and replies via the Sendblue send API. To swap in the official
 * chat-adapter-sendblue package, hand the raw Request to
 * `chat.webhooks.sendblue(req)` here instead of parsing manually.
 */

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

const SEND_URL = "https://api.sendblue.co/api/send-message";

function verifySecret(headers: Headers): boolean {
  const secret = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured (dev) → accept.
  const provided =
    headers.get("sb-signing-secret") ?? headers.get("x-sendblue-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendMessage(toNumber: string, content: string) {
  await fetch(SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sb-api-key-id": process.env.SENDBLUE_API_KEY ?? "",
      "sb-api-secret-key": process.env.SENDBLUE_API_SECRET ?? "",
    },
    body: JSON.stringify({
      number: toNumber,
      content,
      from_number: process.env.SENDBLUE_FROM_NUMBER,
      status_callback: process.env.SENDBLUE_STATUS_CALLBACK_URL,
    }),
  });
}

/** Fetch an inbound media URL and, if it's audio, transcribe it to text. */
async function transcribeMedia(mediaUrl: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (
      !type.startsWith("audio") &&
      !/\.(caf|amr|m4a|mp3|wav)$/i.test(mediaUrl)
    )
      return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { transcribeAudio } = await import("@acme/ext-chat/server");
    return await transcribeAudio(bytes, "openai/whisper-1");
  } catch {
    return null;
  }
}

interface SendbluePayload {
  content?: string;
  media_url?: string;
  number?: string;
  from_number?: string;
  is_outbound?: boolean;
  message_handle?: string;
  was_downgraded?: boolean;
  is_group?: boolean;
}

export const publicRoutes: ExtPublicRouteTable = {
  "POST /webhook": async (req, ctx: ExtPublicRouteContext) => {
    if (!process.env.SENDBLUE_API_KEY || !process.env.SENDBLUE_FROM_NUMBER) {
      return json(503, { error: "Sendblue adapter not configured" });
    }
    if (!verifySecret(req.headers)) {
      return json(401, { error: "Bad secret" });
    }

    const body = (await req.json().catch(() => null)) as SendbluePayload | null;
    if (!body) return json(400, { error: "Invalid body" });

    // Ignore outbound echoes + status callbacks.
    if (body.is_outbound) return Response.json({ ok: true });
    const contact = body.number;
    if (!contact) return Response.json({ ok: true });

    const adapterSettings = await getExtensionSettings<SendblueAdapterSettings>(
      await ctx.getPayload(),
      settings,
    );
    if (!adapterSettings.enabled) return Response.json({ ok: true });

    let text = body.content?.trim() ?? "";
    if (!text && body.media_url) {
      text = (await transcribeMedia(body.media_url)) ?? "";
    }
    if (!text) return Response.json({ ok: true });

    const from = process.env.SENDBLUE_FROM_NUMBER;
    try {
      const result = await handleChannelMessage(
        {
          channel: "sms-sendblue",
          threadKey: `sendblue:${from}:${contact}`,
          contactKey: contact,
          text,
          quotaKey: from,
          isGroup: body.is_group ?? false,
          getPayload: ctx.getPayload,
          dailyQuota: adapterSettings.dailyOutboundQuota,
        },
        body.message_handle,
      );
      if (result.replyText) {
        await sendMessage(contact, result.replyText);
      }
    } catch {
      // Swallow — Sendblue retries; dedupe guards double-replies.
    }

    return Response.json({ ok: true });
  },
};
