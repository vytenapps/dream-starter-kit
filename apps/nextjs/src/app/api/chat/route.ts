import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod/v4";

import type { Database, Json } from "@acme/api";
import {
  AI_MAX_OUTPUT_TOKENS,
  DEFAULT_AI_MODEL,
  slidingWindow,
} from "@acme/config";

import { env } from "~/env";

const bodySchema = z.object({
  threadId: z.uuid(),
  text: z.string().min(1).max(4000),
});

const SYSTEM_PROMPT =
  "You are a concise, friendly assistant inside the Meet Dream app.";

// Per-user rate limit. In-memory (per server instance) — swap for Upstash
// Redis or similar in production.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const hitsByUser = new Map<string, number[]>();

/**
 * AI chat — authed (Bearer token, works web + native), per-user rate-limited,
 * output-token-capped. Calls Claude via the AI Gateway (DEFAULT_AI_MODEL) and
 * persists the user + assistant messages to chat_messages (RLS-scoped). The
 * gateway key never leaves the server.
 */
export async function POST(request: Request) {
  if (!env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the token and scope all DB access to this user via RLS.
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const { allowed, hits } = slidingWindow(
    hitsByUser.get(user.id) ?? [],
    now,
    RATE_WINDOW_MS,
    RATE_LIMIT,
  );
  hitsByUser.set(user.id, hits);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body: unknown = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { threadId, text } = parsed.data;

  // Persist the user message (RLS rejects if the thread isn't the caller's).
  const insertUser = await supabase
    .from("chat_messages")
    .insert({ thread_id: threadId, role: "user", content: text });
  if (insertUser.error) {
    return NextResponse.json({ error: "Thread not found" }, { status: 403 });
  }

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const messages = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    const result = await generateText({
      model: DEFAULT_AI_MODEL,
      system: SYSTEM_PROMPT,
      messages,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });

    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: result.text,
      token_usage: result.usage as unknown as Json,
    });

    return NextResponse.json({
      message: { role: "assistant", content: result.text },
      usage: result.usage,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 500 },
    );
  }
}
