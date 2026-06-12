import "server-only";

import { generateText } from "ai";
import { z } from "zod/v4";

import type { Json } from "@acme/api";
import type { ExtRouteTable } from "@acme/ext-kit/server";
import { AI_MAX_OUTPUT_TOKENS, DEFAULT_AI_MODEL } from "@acme/config";
import { getExtensionSettings } from "@acme/ext-kit/payload";

import type { ChatSettings } from "../payload/settings";
import { settings } from "../payload/settings";

const bodySchema = z.object({
  threadId: z.uuid(),
  text: z.string().min(1).max(4000),
});

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

/**
 * AI chat — served via the host dispatcher at POST /api/ext/chat/stream,
 * which already authenticated the caller (cookie or Bearer) and applied the
 * shared rate limit (golden rule #6). Calls Claude via the AI Gateway
 * (DEFAULT_AI_MODEL stays centralized in @acme/config — golden rule #5) and
 * persists the user + assistant turns to ext_chat_messages, RLS-scoped via
 * ctx.supabase. The system prompt + history window are runtime-tunable from
 * the extension's admin settings screen.
 */
export const routes: ExtRouteTable = {
  "POST /stream": async (req, ctx) => {
    // The gateway key is core server env (validated by the host's zod schema);
    // the `ai` SDK reads AI_GATEWAY_API_KEY from the environment itself.
    if (!process.env.AI_GATEWAY_API_KEY) {
      return json(503, { error: "AI is not configured" });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: "Invalid request" });
    const { threadId, text } = parsed.data;

    // Persist the user message (RLS rejects if the thread isn't the caller's).
    const insertUser = await ctx.supabase
      .from("ext_chat_messages")
      .insert({ thread_id: threadId, role: "user", content: text });
    if (insertUser.error) return json(403, { error: "Thread not found" });

    const chatSettings = await getExtensionSettings<ChatSettings>(
      await ctx.getPayload(),
      settings,
    );

    const { data: history } = await ctx.supabase
      .from("ext_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    const messages = (history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-chatSettings.maxHistoryMessages)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const result = await generateText({
        model: DEFAULT_AI_MODEL,
        system: chatSettings.systemPrompt,
        messages,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      });

      await ctx.supabase.from("ext_chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: result.text,
        token_usage: result.usage as unknown as Json,
      });

      return Response.json({
        message: { role: "assistant", content: result.text },
        usage: result.usage,
      });
    } catch (e) {
      return json(500, {
        error: e instanceof Error ? e.message : "AI request failed",
      });
    }
  },
};
