import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payload } from "payload";

import type { Database } from "@acme/api/types";

/**
 * Notifications dispatch worker — the piece that actually SENDS scheduled
 * Payload `notifications`. Pure and dependency-injected (payload + service-role
 * Supabase client + fetch) so it unit-tests without a server or real devices.
 *
 * Why both clients: the notifications live in the `cms` schema (Payload), while
 * device tokens + the in-app feed live in `public` (RLS, reached via the
 * service-role client). The in-app dispatch route is the one place that has
 * both, which is why this runs in-app rather than as an edge function.
 *
 * Flow per due notification: claim (status→sending), resolve audience to
 * Supabase user ids, fan out Expo push + insert in-app rows, then write back
 * status/sentAt/sentCount (or status=failed on error).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100;

export interface DispatchDeps {
  payload: Payload;
  admin: SupabaseClient<Database>;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Max notifications to process per run (bounded for serverless). */
  limit?: number;
  expoPushUrl?: string;
}

export interface DispatchResult {
  processed: number;
  sent: number;
  failed: number;
}

interface NotificationDoc {
  id: string | number;
  title?: string | null;
  body?: string | null;
  channel?: string[] | null;
  audience?: string | null;
  targetUsers?: (string | number | { id: string | number })[] | null;
  segment?: Record<string, unknown> | null;
  deepLink?: string | null;
  data?: Record<string, unknown> | null;
}

/** Either "everyone" or an explicit set of Supabase user ids. */
type Audience = { all: true } | { all: false; userIds: string[] };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export async function runDispatch(deps: DispatchDeps): Promise<DispatchResult> {
  const { payload, admin } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const expoUrl = deps.expoPushUrl ?? EXPO_PUSH_URL;
  const nowIso = (deps.now ?? new Date()).toISOString();

  const { docs } = await payload.find({
    collection: "notifications",
    where: {
      and: [
        { status: { equals: "scheduled" } },
        { scheduledAt: { less_than_equal: nowIso } },
      ],
    },
    sort: "scheduledAt",
    limit: deps.limit ?? 25,
    depth: 0,
    overrideAccess: true,
  });

  let sent = 0;
  let failed = 0;

  for (const raw of docs as NotificationDoc[]) {
    const id = raw.id;
    try {
      // Claim the row so overlapping cron runs don't double-send.
      await payload.update({
        collection: "notifications",
        id,
        data: { status: "sending" },
        overrideAccess: true,
      });

      const channels = raw.channel ?? ["push"];
      const audience = await resolveAudience(payload, admin, raw);

      let recipientCount = 0;
      if (channels.includes("push")) {
        recipientCount += await sendPush(
          admin,
          fetchImpl,
          expoUrl,
          audience,
          raw,
        );
      }
      if (channels.includes("in_app")) {
        recipientCount += await insertInApp(admin, audience, raw);
      }

      await payload.update({
        collection: "notifications",
        id,
        data: {
          status: "sent",
          sentAt: new Date().toISOString(),
          sentCount: recipientCount,
        },
        overrideAccess: true,
      });
      sent++;
    } catch (err) {
      failed++;
      await payload
        .update({
          collection: "notifications",
          id,
          data: { status: "failed" },
          overrideAccess: true,
        })
        .catch(() => {
          /* best effort — the next run will not retry a 'failed' row */
        });
      payload.logger.error(
        `notifications dispatch: ${id} failed — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { processed: docs.length, sent, failed };
}

// --- Audience resolution ------------------------------------------------------

async function resolveAudience(
  payload: Payload,
  admin: SupabaseClient<Database>,
  notif: NotificationDoc,
): Promise<Audience> {
  const audience = notif.audience ?? "all";
  if (audience === "all") return { all: true };

  if (audience === "users") {
    // targetUsers are CMS user ids; map them to Supabase user ids via the
    // cms.users.supabaseUserId field (that is the key into public device tokens
    // and the in-app feed).
    const cmsIds = (notif.targetUsers ?? []).map((u) =>
      typeof u === "object" ? u.id : u,
    );
    if (cmsIds.length === 0) return { all: false, userIds: [] };
    const { docs } = await payload.find({
      collection: "users",
      where: { id: { in: cmsIds } },
      limit: cmsIds.length,
      depth: 0,
      overrideAccess: true,
    });
    const userIds = (docs as { supabaseUserId?: string | null }[])
      .map((d) => d.supabaseUserId)
      .filter((v): v is string => typeof v === "string");
    return { all: false, userIds };
  }

  // segment: minimal tag-name filter — { tags: ["Pro"] } → users with those tags.
  const segment = notif.segment ?? {};
  const rawTags = (segment as { tags?: unknown }).tags;
  const tagNames = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string")
    : [];
  if (tagNames.length === 0) return { all: false, userIds: [] };

  const { data: tags } = await admin
    .from("tags")
    .select("id")
    .in("name", tagNames);
  const tagIds = (tags ?? []).map((t) => t.id);
  if (tagIds.length === 0) return { all: false, userIds: [] };

  const { data: links } = await admin
    .from("user_tags")
    .select("user_id")
    .in("tag_id", tagIds);
  const userIds = [...new Set((links ?? []).map((l) => l.user_id))];
  return { all: false, userIds };
}

// --- Delivery -----------------------------------------------------------------

async function sendPush(
  admin: SupabaseClient<Database>,
  fetchImpl: typeof fetch,
  expoUrl: string,
  audience: Audience,
  notif: NotificationDoc,
): Promise<number> {
  let query = admin.from("ext_notifications_push_tokens").select("token");
  if (!audience.all) {
    if (audience.userIds.length === 0) return 0;
    query = query.in("user_id", audience.userIds);
  }
  const { data: tokens } = await query;
  const list = (tokens ?? []).map((t) => t.token);
  if (list.length === 0) return 0;

  for (const batch of chunk(list, EXPO_BATCH)) {
    await fetchImpl(expoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title: notif.title ?? "Notification",
          body: notif.body ?? "",
          data: { ...(notif.data ?? {}), deepLink: notif.deepLink ?? null },
          sound: "default",
        })),
      ),
    });
  }
  return list.length;
}

async function insertInApp(
  admin: SupabaseClient<Database>,
  audience: Audience,
  notif: NotificationDoc,
): Promise<number> {
  let userIds: string[];
  if (audience.all) {
    const { data: profiles } = await admin.from("profiles").select("id");
    userIds = (profiles ?? []).map((p) => p.id);
  } else {
    userIds = audience.userIds;
  }
  if (userIds.length === 0) return 0;

  const rows = userIds.map((user_id) => ({
    user_id,
    type: "announcement",
    title: notif.title ?? "Notification",
    body: notif.body ?? null,
    data: { ...(notif.data ?? {}), deepLink: notif.deepLink ?? null },
  }));
  for (const batch of chunk(rows, 500)) {
    await admin.from("ext_notifications").insert(batch);
  }
  return userIds.length;
}
