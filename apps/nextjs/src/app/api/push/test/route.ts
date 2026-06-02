import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api";

import { env } from "~/env";

/**
 * Send a test push to all of the caller's registered devices via the Expo Push
 * API. Authed (Bearer); reads the user's own push_tokens (RLS).
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokens } = await supabase.from("push_tokens").select("token");
  if (!tokens || tokens.length === 0) {
    return NextResponse.json(
      { error: "No registered devices (open the app on a dev build first)" },
      { status: 404 },
    );
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: "Meet Dream",
    body: "🎉 Test notification",
    sound: "default",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  const result: unknown = await res.json();

  return NextResponse.json({ sent: tokens.length, result });
}
