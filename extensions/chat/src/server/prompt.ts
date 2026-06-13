import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BasePayload } from "payload";

import type { Database } from "@acme/api";
import type { ChatChannel } from "@acme/config";

import type { ChatSettings } from "../payload/settings";
import type { ThreadSkillState } from "./routing";
import { artifactsPrompt } from "../vendor/lib/ai/prompts";
import { selectSkill } from "./routing";

/**
 * Channel-aware system-prompt composer (ported from the Sendblue concierge's
 * composePromptFor). Layers, in order:
 *   universal prompt
 *   + channel sub-prompts matching `channel` (empty channels = all)
 *   + selected skill persona (when skill routing is on)
 *   + retrievalBlock  ← empty this phase; the Phase-2 RAG seam
 *   + artifactsPrompt  ← keeps the vendored artifact tools working
 *
 * Also returns the skill selection so the caller can persist stickiness state
 * on the thread.
 */
export interface ComposedPrompt {
  system: string;
  skillSlug: string | null;
}

/**
 * Phase-2 RAG seam: returns extra grounding context (retrieved docs) to inject
 * before the artifacts prompt. Empty this phase; the RAG work-stream fills it
 * by querying the embeddings index.
 */
async function loadRetrievalBlock(): Promise<string> {
  return Promise.resolve("");
}

function channelBlock(settings: ChatSettings, channel: ChatChannel): string {
  const matching = (settings.channelPrompts ?? []).filter((cp) => {
    const channels = cp.channels ?? [];
    return channels.length === 0 || channels.includes(channel);
  });
  return matching.map((cp) => cp.prompt).join("\n\n");
}

export async function composeSystemPrompt(params: {
  payload: BasePayload;
  supabase: SupabaseClient<Database>;
  settings: ChatSettings;
  channel: ChatChannel;
  userText: string;
  thread: ThreadSkillState | null;
}): Promise<ComposedPrompt> {
  const { payload, settings, channel, userText, thread } = params;

  const parts: string[] = [settings.universalPrompt];

  const channels = channelBlock(settings, channel);
  if (channels) parts.push(channels);

  const selection = await selectSkill({ payload, settings, userText, thread });
  if (selection.persona) parts.push(selection.persona);

  // Phase-2 RAG retrieval block slots in here (empty until embeddings land).
  const retrievalBlock = await loadRetrievalBlock();
  if (retrievalBlock) parts.push(retrievalBlock);

  parts.push(artifactsPrompt);

  return { system: parts.join("\n\n"), skillSlug: selection.slug };
}

/** Persist skill stickiness after a turn (web/native streaming path). */
export async function persistSkillState(
  supabase: SupabaseClient<Database>,
  threadId: string,
  settings: ChatSettings,
  prev: ThreadSkillState | null,
  selectedSlug: string | null,
): Promise<void> {
  if (!settings.skillsFeatureEnabled) return;

  let slug = selectedSlug;
  let turns: number;
  if (selectedSlug && selectedSlug !== prev?.activeSkillSlug) {
    turns = settings.stickinessTurns;
  } else if (selectedSlug) {
    turns = Math.max(0, (prev?.activeSkillTurnsRemaining ?? 0) - 1);
  } else if ((prev?.activeSkillTurnsRemaining ?? 0) > 0) {
    slug = prev?.activeSkillSlug ?? null;
    turns = (prev?.activeSkillTurnsRemaining ?? 0) - 1;
  } else {
    slug = null;
    turns = 0;
  }

  await supabase
    .from("ext_chat_threads")
    .update({
      active_skill_slug: slug,
      active_skill_turns_remaining: turns,
    })
    .eq("id", threadId);
}
