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
let projectAId = "";
let itemAId = "";

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

  // As A: create a personal project + item (exercises the INSERT policies).
  const proj = await clientA
    .from("projects")
    .insert({ owner_id: aId, name: "A private project" })
    .select()
    .single();
  expect(proj.error).toBeNull();
  if (!proj.data) throw new Error("project insert returned no row");
  projectAId = proj.data.id;

  const item = await clientA
    .from("items")
    .insert({ project_id: projectAId, created_by: aId, title: "A secret item" })
    .select()
    .single();
  expect(item.error).toBeNull();
  if (!item.data) throw new Error("item insert returned no row");
  itemAId = item.data.id;

  // As service role: give A an active subscription (webhook-style write).
  await admin.from("products").upsert({ id: "prod_rls", name: "RLS Test" });
  await admin.from("prices").upsert({
    id: "price_rls",
    product_id: "prod_rls",
    active: true,
    unit_amount: 100,
    currency: "usd",
    type: "recurring",
    interval: "month",
  });
  await admin.from("subscriptions").upsert({
    id: `sub_rls_${stamp}`,
    user_id: aId,
    price_id: "price_rls",
    status: "active",
  });
});

afterAll(async () => {
  await admin.from("subscriptions").delete().eq("user_id", aId);
  if (projectAId) await admin.from("projects").delete().eq("id", projectAId); // cascades items
  if (aId) await admin.auth.admin.deleteUser(aId);
  if (bId) await admin.auth.admin.deleteUser(bId);
});

describe("RLS: a user only sees their own rows", () => {
  it("A can read A's own item", async () => {
    const { data, error } = await clientA
      .from("items")
      .select("*")
      .eq("id", itemAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("B cannot read A's item", async () => {
    const { data, error } = await clientB
      .from("items")
      .select("*")
      .eq("id", itemAId);
    expect(error).toBeNull(); // RLS filters silently — not an error, just no rows
    expect(data).toHaveLength(0);
  });

  it("B cannot read A's project", async () => {
    const { data } = await clientB
      .from("projects")
      .select("*")
      .eq("id", projectAId);
    expect(data).toHaveLength(0);
  });

  it("B cannot read A's subscription", async () => {
    const { data } = await clientB
      .from("subscriptions")
      .select("*")
      .eq("user_id", aId);
    expect(data).toHaveLength(0);
  });

  it("A can read A's own subscription", async () => {
    const { data } = await clientA
      .from("subscriptions")
      .select("*")
      .eq("user_id", aId);
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("RLS: a user cannot write into another user's rows", () => {
  it("B cannot insert an item into A's project", async () => {
    const { error } = await clientB
      .from("items")
      .insert({ project_id: projectAId, created_by: bId, title: "intrusion" });
    expect(error).not.toBeNull(); // WITH CHECK (can_access_project) rejects it
  });

  it("B's UPDATE of A's item does not change it", async () => {
    await clientB.from("items").update({ title: "hacked" }).eq("id", itemAId);
    const { data } = await admin
      .from("items")
      .select("title")
      .eq("id", itemAId)
      .single();
    expect(data?.title).toBe("A secret item");
  });

  it("B's DELETE of A's item affects zero rows", async () => {
    await clientB.from("items").delete().eq("id", itemAId);
    const { count } = await admin
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("id", itemAId);
    expect(count).toBe(1);
  });
});

describe("RLS: public catalog is readable", () => {
  it("B can read the products catalog", async () => {
    const { data, error } = await clientB.from("products").select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
