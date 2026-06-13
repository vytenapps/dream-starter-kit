import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BasePayload } from "payload";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

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
 * (Sendblue, Slack, …). Adapter extensions verify + normalize their webhook,
 * then call `handleChannelMessage`; it dedupes, upserts contact/thread state,
 * runs the channel-aware prompt composer + skill router, generates a reply
 * with the AI Gateway, persists the turn + skill stickiness, and enforces
 * opt-out + a daily outbound quota. Channel state lives in service-path tables
 * (no RLS client touches it), so this uses a service-role client — webhooks
 * have no user session. (golden rule #2 allows service-role in server code.)
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

interface ChannelThreadMessage {
  role: "user" | "assistant";
  content: string;
}

export interface HandleChannelMessageParams {
  channel: ChatChannel;
  /** Stable per-conversation id from the adapter (e.g. the Chat SDK thread id). */
  threadKey: string;
  /** Stable per-sender id (phone number, Slack user id, …). */
  contactKey: string;
  text: string;
  /** Optional sender id used for the daily outbound quota (e.g. the from-number). */
  quotaKey?: string;
  displayName?: string;
  isGroup?: boolean;
  getPayload: () => Promise<BasePayload>;
  /** Per-day outbound cap; 0 disables the check. */
  dailyQuota?: number;
}

export interface HandleChannelMessageResult {
  replyText: string | null;
  /** Why no reply (dedupe/opt-out/quota) — useful for the adapter's logs. */
  reason?: "duplicate" | "opted-out" | "quota-exceeded" | "stop" | "help";
}

const STOP_WORDS = new Set(["stop", "unsubscribe", "cancel", "end", "quit"]);
const HELP_WORDS = new Set(["help", "info"]);
const MAX_HISTORY = 20;

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

  // 4. Load thread state + history.
  const { data: thread } = await sb
    .from("ext_chat_channel_threads")
    .select("*")
    .eq("channel", channel)
    .eq("thread_key", threadKey)
    .maybeSingle();

  const history = (
    (thread?.messages as { role: string; content: string }[] | null) ?? []
  )
    .filter(
      (m): m is ChannelThreadMessage =>
        m.role === "user" || m.role === "assistant",
    )
    .slice(-MAX_HISTORY);

  const payload = await params.getPayload();
  const chatSettings = await getExtensionSettings<ChatSettings>(
    payload,
    settings,
  );

  const priorSkill: ThreadSkillState | null = thread
    ? {
        activeSkillSlug: thread.active_skill_slug,
        activeSkillTurnsRemaining: thread.active_skill_turns_remaining,
      }
    : null;

  const composed = await composeSystemPrompt({
    payload,
    supabase: sb,
    settings: chatSettings,
    channel,
    userText: text,
    thread: priorSkill,
  });

  // 5. Generate (channels are buffered, not streamed).
  const result = await generateText({
    model: DEFAULT_AI_MODEL,
    system: composed.system,
    messages: [...history, { role: "user" as const, content: text }],
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
  });
  const replyText = result.text;

  // 6. Persist turn + skill stickiness.
  const newHistory: ChannelThreadMessage[] = [
    ...history,
    { role: "user" as const, content: text },
    { role: "assistant" as const, content: replyText },
  ].slice(-MAX_HISTORY);

  const nextSkill = computeStickiness(
    chatSettings,
    priorSkill,
    composed.skillSlug,
  );

  await sb.from("ext_chat_channel_threads").upsert(
    {
      channel,
      thread_key: threadKey,
      contact_key: contactKey,
      messages: newHistory as unknown as Json,
      active_skill_slug: nextSkill.slug,
      active_skill_turns_remaining: nextSkill.turns,
      is_group: params.isGroup ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,thread_key" },
  );

  // 7. Bump the outbound counter.
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
