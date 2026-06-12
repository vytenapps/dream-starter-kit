/**
 * RLS isolation regression — the security gate for the whole kit.
 *
 * Proves that Row-Level Security stops user B from reading or writing user A's
 * rows. Runs against a LIVE local Supabase (`supabase start`) or CI service.
 *
 *   pnpm test:rls          # from repo root
 *
 * Requires env (loaded from .env): NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL),
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY.
 *
 * NOTE: Payload CMS content lives in a separate `cms` Postgres schema, OUTSIDE
 * RLS by design (access is enforced by Payload, not Postgres). It is intentionally
 * not covered here — this gate protects the RLS-governed `public` (app) tables.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@acme/api/types";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const rawAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const rawService = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !rawAnon || !rawService) {
  throw new Error(
    "test:rls requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
      "and SUPABASE_SERVICE_ROLE_KEY. Run `supabase start` and copy the printed " +
      "keys into .env.",
  );
}
const SUPABASE_URL = rawUrl;
const ANON_KEY = rawAnon;
const SERVICE_KEY = rawService;

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, noPersist);

const stamp = Date.now();
const userA = { email: `rls-a-${stamp}@test.local`, password: "password123!" };
const userB = { email: `rls-b-${stamp}@test.local`, password: "password123!" };

let aId = "";
let bId = "";
let clientA: SupabaseClient<Database>;
let clientB: SupabaseClient<Database>;
let threadAId = "";
let reminderAId = "";
let orgAId = "";
let msgAId = "";
let notifAId = "";
let tagId = "";

async function createUser(email: string, password: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function signIn(
  email: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, noPersist);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  aId = await createUser(userA.email, userA.password);
  bId = await createUser(userB.email, userB.password);
  clientA = await signIn(userA.email, userA.password);
  clientB = await signIn(userB.email, userB.password);

  // As A: create owner-scoped rows (exercises the INSERT WITH CHECK policies).
  const thread = await clientA
    .from("ext_chat_threads")
    .insert({ user_id: aId, title: "A private thread" })
    .select()
    .single();
  expect(thread.error).toBeNull();
  if (!thread.data) throw new Error("chat_threads insert returned no row");
  threadAId = thread.data.id;

  const reminder = await clientA
    .from("ext_reminders")
    .insert({
      user_id: aId,
      due_at: new Date(stamp + 86_400_000).toISOString(),
      channel: "push",
    })
    .select()
    .single();
  expect(reminder.error).toBeNull();
  if (!reminder.data) throw new Error("reminders insert returned no row");
  reminderAId = reminder.data.id;

  // As service role: give A an active subscription (webhook-style write).
  await admin
    .from("ext_billing_products")
    .upsert({ id: "prod_rls", name: "RLS Test" });
  await admin.from("ext_billing_prices").upsert({
    id: "price_rls",
    product_id: "prod_rls",
    active: true,
    unit_amount: 100,
    currency: "usd",
    type: "recurring",
    interval: "month",
  });
  await admin.from("ext_billing_subscriptions").upsert({
    id: `sub_rls_${stamp}`,
    user_id: aId,
    price_id: "price_rls",
    status: "active",
  });

  // As A: an organization. The on_organization_created trigger (SECURITY
  // DEFINER) auto-enrolls A as an 'owner' member — this is what makes the
  // relational org/membership/invitation policies (is_org_member/is_org_admin)
  // grant A access in the first place.
  const org = await clientA
    .from("organizations")
    .insert({ name: "A's org", owner_id: aId })
    .select()
    .single();
  expect(org.error).toBeNull();
  if (!org.data) throw new Error("organizations insert returned no row");
  orgAId = org.data.id;

  // As A: a message under A's own thread. chat_messages' policy is INDIRECT —
  // it authorizes via ownership of the parent chat_thread, not a user_id column.
  const msg = await clientA
    .from("ext_chat_messages")
    .insert({ thread_id: threadAId, role: "user", content: "hello" })
    .select()
    .single();
  expect(msg.error).toBeNull();
  if (!msg.data) throw new Error("chat_messages insert returned no row");
  msgAId = msg.data.id;

  // As A: owner-scoped push token + file metadata rows.
  await clientA
    .from("ext_notifications_push_tokens")
    .insert({ user_id: aId, token: `ExpoTok-${stamp}`, platform: "ios" });
  await clientA.from("files").insert({
    user_id: aId,
    path: `${aId}/avatar.png`,
    mime_type: "image/png",
  });

  // As service role: a customer row and a notification for A (these are written
  // by the server/webhook, never by clients — RLS only grants read-own).
  await admin
    .from("ext_billing_customers")
    .insert({ user_id: aId, stripe_customer_id: `cus_rls_${stamp}` });
  const notif = await admin
    .from("ext_notifications")
    .insert({ user_id: aId, type: "reminder", title: "Hi" })
    .select()
    .single();
  if (!notif.data) throw new Error("notifications insert returned no row");
  notifAId = notif.data.id;

  // A tag definition + a link assigning it to A (service-role written).
  const tag = await admin
    .from("tags")
    .insert({ name: `rls-tag-${stamp}`, is_system: false })
    .select()
    .single();
  if (!tag.data) throw new Error("tags insert returned no row");
  tagId = tag.data.id;
  await admin.from("user_tags").insert({ user_id: aId, tag_id: tagId });
});

afterAll(async () => {
  await admin.from("ext_billing_subscriptions").delete().eq("user_id", aId);
  await admin.from("ext_billing_subscriptions").delete().eq("user_id", bId);
  if (orgAId) await admin.from("organizations").delete().eq("id", orgAId); // cascades memberships + invitations
  await admin.from("ext_billing_customers").delete().eq("user_id", aId);
  await admin.from("ext_notifications").delete().eq("user_id", aId);
  if (tagId) await admin.from("tags").delete().eq("id", tagId); // cascades user_tags
  await admin.from("ext_notifications_push_tokens").delete().eq("user_id", aId);
  await admin.from("files").delete().eq("user_id", aId);
  if (threadAId)
    await admin.from("ext_chat_threads").delete().eq("id", threadAId); // cascades chat_messages
  if (reminderAId)
    await admin.from("ext_reminders").delete().eq("id", reminderAId);
  if (aId) await admin.auth.admin.deleteUser(aId);
  if (bId) await admin.auth.admin.deleteUser(bId);
});

describe("RLS: a user only sees their own rows", () => {
  it("A can read A's own chat thread", async () => {
    const { data, error } = await clientA
      .from("ext_chat_threads")
      .select("*")
      .eq("id", threadAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("B cannot read A's chat thread", async () => {
    const { data, error } = await clientB
      .from("ext_chat_threads")
      .select("*")
      .eq("id", threadAId);
    expect(error).toBeNull(); // RLS filters silently — not an error, just no rows
    expect(data).toHaveLength(0);
  });

  it("B cannot read A's reminder", async () => {
    const { data } = await clientB
      .from("ext_reminders")
      .select("*")
      .eq("id", reminderAId);
    expect(data).toHaveLength(0);
  });

  it("B cannot read A's subscription", async () => {
    const { data } = await clientB
      .from("ext_billing_subscriptions")
      .select("*")
      .eq("user_id", aId);
    expect(data).toHaveLength(0);
  });

  it("A can read A's own subscription", async () => {
    const { data } = await clientA
      .from("ext_billing_subscriptions")
      .select("*")
      .eq("user_id", aId);
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("RLS: a user cannot write into another user's rows", () => {
  it("B cannot insert a chat thread owned by A", async () => {
    const { error } = await clientB
      .from("ext_chat_threads")
      .insert({ user_id: aId, title: "intrusion" });
    expect(error).not.toBeNull(); // WITH CHECK (user_id = auth.uid()) rejects it
  });

  it("B's UPDATE of A's chat thread does not change it", async () => {
    await clientB
      .from("ext_chat_threads")
      .update({ title: "hacked" })
      .eq("id", threadAId);
    const { data } = await admin
      .from("ext_chat_threads")
      .select("title")
      .eq("id", threadAId)
      .single();
    expect(data?.title).toBe("A private thread");
  });

  it("B's DELETE of A's chat thread affects zero rows", async () => {
    await clientB.from("ext_chat_threads").delete().eq("id", threadAId);
    const { count } = await admin
      .from("ext_chat_threads")
      .select("*", { count: "exact", head: true })
      .eq("id", threadAId);
    expect(count).toBe(1);
  });
});

describe("RLS: public catalog is readable", () => {
  it("B can read the products catalog", async () => {
    const { data, error } = await clientB
      .from("ext_billing_products")
      .select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("RLS: profiles are private to their owner", () => {
  it("A can read A's own profile", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("*")
      .eq("id", aId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("B cannot read A's profile", async () => {
    const { data } = await clientB.from("profiles").select("*").eq("id", aId);
    expect(data).toHaveLength(0);
  });

  it("a user cannot escalate their own is_staff flag", async () => {
    // The UPDATE privilege is column-scoped to (display_name, avatar_url), so an
    // attempt to flip is_staff is rejected by Postgres and the value is unchanged.
    await clientB.from("profiles").update({ is_staff: true }).eq("id", bId);
    const { data } = await admin
      .from("profiles")
      .select("is_staff")
      .eq("id", bId)
      .single();
    expect(data?.is_staff).toBe(false);
  });
});

describe("RLS: organizations / memberships / invitations (relational)", () => {
  it("creating an org auto-enrolls the owner as an 'owner' member (trigger)", async () => {
    const { data, error } = await clientA
      .from("memberships")
      .select("role")
      .eq("org_id", orgAId)
      .eq("user_id", aId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.role).toBe("owner");
  });

  it("A (a member) can read A's org", async () => {
    const { data } = await clientA
      .from("organizations")
      .select("*")
      .eq("id", orgAId);
    expect(data).toHaveLength(1);
  });

  it("B (a non-member) cannot read A's org", async () => {
    const { data } = await clientB
      .from("organizations")
      .select("*")
      .eq("id", orgAId);
    expect(data).toHaveLength(0);
  });

  it("B cannot read A's org memberships", async () => {
    const { data } = await clientB
      .from("memberships")
      .select("*")
      .eq("org_id", orgAId);
    expect(data).toHaveLength(0);
  });

  it("B (not an admin) cannot insert a membership into A's org", async () => {
    const { error } = await clientB
      .from("memberships")
      .insert({ org_id: orgAId, user_id: bId, role: "member" });
    expect(error).not.toBeNull(); // is_org_admin(org_id) is false for B
  });

  it("A (an admin) can create an invitation; B can neither read nor create one", async () => {
    const created = await clientA
      .from("invitations")
      .insert({ org_id: orgAId, email: "invitee@test.local", role: "member" })
      .select()
      .single();
    expect(created.error).toBeNull();
    expect(created.data).not.toBeNull();

    const readByB = await clientB
      .from("invitations")
      .select("*")
      .eq("org_id", orgAId);
    expect(readByB.data).toHaveLength(0);

    const writeByB = await clientB
      .from("invitations")
      .insert({ org_id: orgAId, email: "evil@test.local", role: "admin" });
    expect(writeByB.error).not.toBeNull();
  });
});

describe("RLS: chat_messages inherit their thread's owner", () => {
  it("A can read A's own message", async () => {
    const { data, error } = await clientA
      .from("ext_chat_messages")
      .select("*")
      .eq("id", msgAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("B cannot read a message inside A's thread", async () => {
    const { data } = await clientB
      .from("ext_chat_messages")
      .select("*")
      .eq("id", msgAId);
    expect(data).toHaveLength(0);
  });

  it("B cannot insert a message into A's thread", async () => {
    const { error } = await clientB
      .from("ext_chat_messages")
      .insert({ thread_id: threadAId, role: "user", content: "intrusion" });
    expect(error).not.toBeNull(); // the EXISTS-on-own-thread check fails for B
  });
});

describe("RLS: notifications are private to their owner", () => {
  it("A can read A's notification", async () => {
    const { data } = await clientA
      .from("ext_notifications")
      .select("*")
      .eq("id", notifAId);
    expect(data).toHaveLength(1);
  });

  it("A can mark A's own notification read", async () => {
    const { error } = await clientA
      .from("ext_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notifAId);
    expect(error).toBeNull();
    const { data } = await admin
      .from("ext_notifications")
      .select("read_at")
      .eq("id", notifAId)
      .single();
    expect(data?.read_at).not.toBeNull();
  });

  it("B cannot read or modify A's notification", async () => {
    const { data } = await clientB
      .from("ext_notifications")
      .select("*")
      .eq("id", notifAId);
    expect(data).toHaveLength(0);

    await clientB
      .from("ext_notifications")
      .update({ title: "hacked" })
      .eq("id", notifAId);
    const { data: after } = await admin
      .from("ext_notifications")
      .select("title")
      .eq("id", notifAId)
      .single();
    expect(after?.title).toBe("Hi");
  });
});

describe("RLS: push_tokens and files are owner-scoped", () => {
  it("B cannot read A's push token", async () => {
    const { data } = await clientB
      .from("ext_notifications_push_tokens")
      .select("*")
      .eq("user_id", aId);
    expect(data).toHaveLength(0);
  });

  it("B cannot register a push token owned by A", async () => {
    const { error } = await clientB
      .from("ext_notifications_push_tokens")
      .insert({ user_id: aId, token: `evil-${stamp}`, platform: "ios" });
    expect(error).not.toBeNull();
  });

  it("B cannot read A's file metadata", async () => {
    const { data } = await clientB.from("files").select("*").eq("user_id", aId);
    expect(data).toHaveLength(0);
  });

  it("B cannot insert file metadata owned by A", async () => {
    const { error } = await clientB
      .from("files")
      .insert({ user_id: aId, path: `${aId}/evil.png` });
    expect(error).not.toBeNull();
  });
});

describe("RLS: customers are read-own (service-role written)", () => {
  it("A can read A's own customer row", async () => {
    const { data } = await clientA
      .from("ext_billing_customers")
      .select("*")
      .eq("user_id", aId);
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("B cannot read A's customer row", async () => {
    const { data } = await clientB
      .from("ext_billing_customers")
      .select("*")
      .eq("user_id", aId);
    expect(data).toHaveLength(0);
  });
});

describe("RLS: user_tags are private to their owner", () => {
  it("A can read A's own tags", async () => {
    const { data, error } = await clientA
      .from("user_tags")
      .select("*")
      .eq("user_id", aId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("B cannot read A's tags", async () => {
    const { data } = await clientB
      .from("user_tags")
      .select("*")
      .eq("user_id", aId);
    expect(data).toHaveLength(0);
  });

  it("B cannot assign a tag to A (no client write policy)", async () => {
    const { error } = await clientB
      .from("user_tags")
      .insert({ user_id: aId, tag_id: tagId });
    expect(error).not.toBeNull();
  });

  it("tag definitions are readable by any authenticated user", async () => {
    const { data, error } = await clientB
      .from("tags")
      .select("*")
      .eq("id", tagId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("premium gating: only active/trialing subscriptions unlock premium", () => {
  // Mirrors the exact query in packages/app/src/hooks/use-premium.ts
  // (usePremium): read-own subscriptions, filtered to active/trialing, newest
  // period first. This pins the premium gate (golden rule #4) — RLS read-own
  // AND the status filter together — against B, who starts with no subscription.
  const ACTIVE_STATUSES = ["active", "trialing"];
  const day = 86_400_000;

  async function premiumRow(client: SupabaseClient<Database>) {
    const { data, error } = await client
      .from("ext_billing_subscriptions")
      .select("status, price_id, current_period_end")
      .in("status", ACTIVE_STATUSES)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(error).toBeNull();
    return data;
  }

  it("returns nothing when the user has only canceled/past_due rows", async () => {
    await admin.from("ext_billing_subscriptions").insert([
      {
        id: `sub_b_canceled_${stamp}`,
        user_id: bId,
        price_id: "price_rls",
        status: "canceled",
        current_period_end: new Date(stamp - day).toISOString(),
      },
      {
        id: `sub_b_pastdue_${stamp}`,
        user_id: bId,
        price_id: "price_rls",
        status: "past_due",
        current_period_end: new Date(stamp - 2 * day).toISOString(),
      },
    ]);
    expect(await premiumRow(clientB)).toBeNull();
  });

  it("returns the newest active/trialing row once the user has one", async () => {
    await admin.from("ext_billing_subscriptions").insert([
      {
        id: `sub_b_active_${stamp}`,
        user_id: bId,
        price_id: "price_rls",
        status: "active",
        current_period_end: new Date(stamp + day).toISOString(),
      },
      {
        id: `sub_b_trialing_${stamp}`,
        user_id: bId,
        price_id: "price_rls",
        status: "trialing",
        current_period_end: new Date(stamp + 10 * day).toISOString(),
      },
    ]);
    const row = await premiumRow(clientB);
    // trialing has the latest current_period_end among active/trialing, so it
    // wins — and canceled/past_due are excluded by the status filter.
    expect(row?.status).toBe("trialing");
  });
});
