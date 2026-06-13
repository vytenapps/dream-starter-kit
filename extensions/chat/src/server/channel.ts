import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import config from "@payload-config";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { getPayload } from "payload";

import type { Database, Json } from "@acme/api";
import type { ChatChannel } from "@acme/config";
import { AI_MAX_OUTPUT_TOKENS, DEFAULT_AI_MODEL } from "@acme/config";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { ChatSettings } from "../payload/settings";
import type { ThreadSkillState } from "./routing";
import { settings } from "../payload/settings";
import { composeSystemPrompt } from "./prompt";

/**
 * Channel framework — the shared brain behind every chat-adapter-* extension
 * (Sendblue, Slack, …). Adapter extensions hand their webhook to the Chat SDK,
 * whose handlers call `handleChannelMessage`; it dedupes, applies STOP/HELP
 * compliance + a daily quota, routes the message through the channel-aware
 * prompt composer + skill router, generates a reply, and persists the turn.
 *
 * Crucially, ALL channels persist into the SAME ext_chat_threads /
 * ext_chat_messages tables that back web + mobile chat — keyed by
 * (channel, channel_thread_key) and owned by `user_id` once the channel
 * contact is linked to an app account. So a signed-in user's web/mobile chat
 * history automatically includes their Slack / Sendblue / etc. conversations.
 * Webhooks have no user session, so this uses a service-role client (golden
 * rule #2 allows service-role in server code).
 */

let serviceClient: SupabaseClient<Database> | null = null;
function getServiceClient(): SupabaseClient<Database> {
  serviceClient ??= createClient<Database>(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
  return serviceClient;
}

export interface HandleChannelMessageParams {
  channel: ChatChannel;
  /** Stable per-conversation id from the adapter (the Chat SDK thread id). */
  threadKey: string;
  /** Stable per-sender id (phone number, Slack user id, …). */
  contactKey: string;
  text: string;
  /** Sender id used for the daily outbound quota (e.g. the from-number). */
  quotaKey?: string;
  displayName?: string;
  isGroup?: boolean;
  /** Per-day outbound cap; 0 disables the check. */
  dailyQuota?: number;
}

export interface HandleChannelMessageResult {
  replyText: string | null;
  reason?: "duplicate" | "opted-out" | "quota-exceeded" | "stop" | "help";
}

const STOP_WORDS = new Set(["stop", "unsubscribe", "cancel", "end", "quit"]);
const HELP_WORDS = new Set(["help", "info"]);

type ThreadRow = Database["public"]["Tables"]["ext_chat_threads"]["Row"];

export async function handleChannelMessage(
  params: HandleChannelMessageParams,
  messageHandle?: string,
): Promise<HandleChannelMessageResult> {
  const sb = getServiceClient();
  const { channel, threadKey, contactKey, text } = params;

  // 1. Dedupe by the platform message handle (at-least-once webhooks).
  if (messageHandle) {
    const dup = await sb
      .from("ext_chat_processed_inbound")
      .insert({ message_handle: messageHandle, channel });
    if (dup.error) return { replyText: null, reason: "duplicate" };
  }

  // 2. Contact upsert + STOP/HELP compliance.
  const { data: contact } = await sb
    .from("ext_chat_channel_contacts")
    .upsert(
      {
        channel,
        contact_key: contactKey,
        display_name: params.displayName ?? null,
      },
      { onConflict: "channel,contact_key" },
    )
    .select()
    .single();

  const normalized = text.trim().toLowerCase();
  if (STOP_WORDS.has(normalized)) {
    await sb
      .from("ext_chat_channel_contacts")
      .update({ opted_out: true })
      .eq("channel", channel)
      .eq("contact_key", contactKey);
    return {
      replyText: "You're unsubscribed and won't get more messages.",
      reason: "stop",
    };
  }
  if (contact?.opted_out) {
    if (HELP_WORDS.has(normalized) || normalized === "start") {
      await sb
        .from("ext_chat_channel_contacts")
        .update({ opted_out: false })
        .eq("channel", channel)
        .eq("contact_key", contactKey);
    } else {
      return { replyText: null, reason: "opted-out" };
    }
  }
  if (HELP_WORDS.has(normalized)) {
    return {
      replyText:
        "Reply STOP to unsubscribe. Otherwise, just tell me what you need.",
      reason: "help",
    };
  }

  // 3. Daily outbound quota (per sender).
  if (params.dailyQuota && params.dailyQuota > 0 && params.quotaKey) {
    const day = new Date().toISOString().slice(0, 10);
    const { data: counter } = await sb
      .from("ext_chat_outbound_counters")
      .select("count")
      .eq("sender", params.quotaKey)
      .eq("day", day)
      .maybeSingle();
    if ((counter?.count ?? 0) >= params.dailyQuota) {
      return { replyText: null, reason: "quota-exceeded" };
    }
  }

  // 4. Resolve the unified thread row (shared with web/mobile history).
  const { data: existing } = await sb
    .from("ext_chat_threads")
    .select("*")
    .eq("channel", channel)
    .eq("channel_thread_key", threadKey)
    .maybeSingle();

  let thread = existing as ThreadRow | null;
  if (!thread) {
    const title = `${params.displayName ?? contactKey} · ${channel}`.slice(
      0,
      120,
    );
    const insert = await sb
      .from("ext_chat_threads")
      .insert({
        user_id: contact?.user_id ?? null,
        channel,
        channel_thread_key: threadKey,
        contact_key: contactKey,
        title,
      })
      .select()
      .single();
    if (insert.error) {
      return { replyText: null };
    }
    thread = insert.data;
  } else if (contact?.user_id && thread.user_id !== contact.user_id) {
    // Contact got linked since the thread was created — adopt the owner so it
    // surfaces in that user's web/mobile history.
    await sb
      .from("ext_chat_threads")
      .update({ user_id: contact.user_id })
      .eq("id", thread.id);
  }
  const threadId = thread.id;

  const payload = await getPayload({ config });
  const chatSettings = await getExtensionSettings<ChatSettings>(
    payload,
    settings,
  );

  // 5. History from the unified messages table.
  const { data: historyRows } = await sb
    .from("ext_chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const history = (historyRows ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-chatSettings.maxHistoryMessages)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Persist the inbound user turn.
  await sb.from("ext_chat_messages").insert({
    thread_id: threadId,
    role: "user",
    content: text,
    parts: [{ type: "text", text }] as unknown as Json,
  });

  const priorSkill: ThreadSkillState = {
    activeSkillSlug: thread.active_skill_slug,
    activeSkillTurnsRemaining: thread.active_skill_turns_remaining,
  };

  const composed = await composeSystemPrompt({
    payload,
    supabase: sb,
    settings: chatSettings,
    channel,
    userText: text,
    thread: priorSkill,
  });

  // 6. Generate (channels are buffered, not streamed).
  const result = await generateText({
    model: DEFAULT_AI_MODEL,
    system: composed.system,
    messages: [...history, { role: "user" as const, content: text }],
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
  });
  const replyText = result.text;

  // 7. Persist the assistant turn + skill stickiness.
  await sb.from("ext_chat_messages").insert({
    thread_id: threadId,
    role: "assistant",
    content: replyText,
    parts: [{ type: "text", text: replyText }] as unknown as Json,
    token_usage: result.usage as unknown as Json,
  });

  const nextSkill = computeStickiness(
    chatSettings,
    priorSkill,
    composed.skillSlug,
  );
  await sb
    .from("ext_chat_threads")
    .update({
      active_skill_slug: nextSkill.slug,
      active_skill_turns_remaining: nextSkill.turns,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  // 8. Bump the outbound counter.
  if (params.dailyQuota && params.dailyQuota > 0 && params.quotaKey) {
    const day = new Date().toISOString().slice(0, 10);
    const { data: counter } = await sb
      .from("ext_chat_outbound_counters")
      .select("count")
      .eq("sender", params.quotaKey)
      .eq("day", day)
      .maybeSingle();
    await sb
      .from("ext_chat_outbound_counters")
      .upsert(
        { sender: params.quotaKey, day, count: (counter?.count ?? 0) + 1 },
        { onConflict: "sender,day" },
      );
  }

  return { replyText };
}

/**
 * Link a channel contact to an app user so their channel threads merge into
 * that user's web/mobile history. Called by the authed POST /channels/link
 * route; sets the contact owner and backfills existing threads.
 */
export async function linkChannelContact(
  channel: string,
  contactKey: string,
  userId: string,
): Promise<void> {
  const sb = getServiceClient();
  await sb
    .from("ext_chat_channel_contacts")
    .upsert(
      { channel, contact_key: contactKey, user_id: userId },
      { onConflict: "channel,contact_key" },
    );
  await sb
    .from("ext_chat_threads")
    .update({ user_id: userId })
    .eq("channel", channel)
    .eq("contact_key", contactKey);
}

function computeStickiness(
  s: ChatSettings,
  prev: ThreadSkillState | null,
  selected: string | null,
): { slug: string | null; turns: number } {
  if (!s.skillsFeatureEnabled) return { slug: null, turns: 0 };
  if (selected && selected !== prev?.activeSkillSlug) {
    return { slug: selected, turns: s.stickinessTurns };
  }
  if (selected) {
    return {
      slug: selected,
      turns: Math.max(0, (prev?.activeSkillTurnsRemaining ?? 0) - 1),
    };
  }
  if ((prev?.activeSkillTurnsRemaining ?? 0) > 0) {
    return {
      slug: prev?.activeSkillSlug ?? null,
      turns: (prev?.activeSkillTurnsRemaining ?? 0) - 1,
    };
  }
  return { slug: null, turns: 0 };
}
