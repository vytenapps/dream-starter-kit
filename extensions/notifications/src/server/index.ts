import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, TablesInsert } from "@acme/api";
import type { ExtRouteTable } from "@acme/ext-kit/server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface NotifyInput {
  userId: string;
  type: string;
  title?: string;
  body?: string;
  data?: Json;
  /** Also fan out an Expo push to the user's registered devices (default true). */
  push?: boolean;
}

/**
 * The notifications SERVICE (docs/EXTENSIONS-PLAN.md §1.5): insert an in-app
 * notification and fan out Expo push. Any extension that `requires`
 * ["notifications"] may call this from its server routes.
 *
 * `db` is either the caller's RLS-scoped client (self-notifications — RLS
 * permits writing your own rows) or the service-role client (edge functions /
 * webhooks notifying arbitrary users). Deno edge functions that can't import
 * workspace code follow the equivalent SQL contract directly: insert into
 * ext_notifications + read ext_notifications_push_tokens.
 */
export async function notify(
  db: SupabaseClient<Database>,
  input: NotifyInput,
): Promise<void> {
  const row: TablesInsert<"ext_notifications"> = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
  };
  const { error } = await db.from("ext_notifications").insert(row);
  if (error) throw new Error(`notify: insert failed — ${error.message}`);

  if (input.push === false) return;
  const { data: tokens } = await db
    .from("ext_notifications_push_tokens")
    .select("token")
    .eq("user_id", input.userId);
  if (!tokens || tokens.length === 0) return;

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
        title: input.title ?? input.type,
        body: input.body,
        sound: "default",
      })),
    ),
  });
}

/**
 * Extension API routes, served via the host dispatcher at
 * /api/ext/notifications/* — already authenticated (cookie or Bearer) and
 * rate-limited before a handler runs.
 */
export const routes: ExtRouteTable = {
  /** Send a test push to all of the caller's registered devices. */
  "POST /push-test": async (_req, ctx) => {
    const { data: tokens } = await ctx.supabase
      .from("ext_notifications_push_tokens")
      .select("token");
    if (!tokens || tokens.length === 0) {
      return Response.json(
        { error: "No registered devices (open the app on a dev build first)" },
        { status: 404 },
      );
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.token,
          title: "Dream",
          body: "🎉 Test notification",
          sound: "default",
        })),
      ),
    });
    const result: unknown = await res.json();

    return Response.json({ sent: tokens.length, result });
  },
};
