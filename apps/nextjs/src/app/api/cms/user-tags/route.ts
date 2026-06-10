import { headers } from "next/headers";
import { NextResponse } from "next/server";
import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod/v4";

import { createTagSchema } from "@acme/app";

import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Staff endpoint for viewing/managing a user's tags from the Payload admin Users
 * page. Authed via the Payload admin session (only staff get one). Tags live in
 * the RLS-governed `public` schema, so reads/writes go through the service-role
 * admin client. Keyed by the Payload user doc id → its `supabaseUserId`.
 */
export const dynamic = "force-dynamic";

async function resolveSupabaseUserId(docId: string): Promise<string | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) return null;
  const doc = await payload
    .findByID({ collection: "users", id: docId, depth: 0 })
    .catch(() => null);
  return (doc?.supabaseUserId as string | undefined) ?? null;
}

async function listTags(userId: string) {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("user_tags")
    .select("tag_id")
    .eq("user_id", userId);
  const ids = (links ?? []).map((l) => l.tag_id);
  if (ids.length === 0) return [];
  const { data: tags } = await admin
    .from("tags")
    .select("id, name, color")
    .in("id", ids)
    .order("name");
  return tags ?? [];
}

export async function GET(request: Request) {
  const docId = new URL(request.url).searchParams.get("docId");
  if (!docId)
    return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  const userId = await resolveSupabaseUserId(docId);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tags: await listTags(userId) });
}

const postSchema = createTagSchema.extend({ docId: z.string() });

export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const userId = await resolveSupabaseUserId(parsed.data.docId);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: tag, error } = await admin
    .from("tags")
    .upsert(
      { name: parsed.data.name, color: parsed.data.color ?? null },
      { onConflict: "name" },
    )
    .select("id")
    .maybeSingle();
  if (error || !tag) {
    return NextResponse.json(
      { error: "Could not create tag" },
      { status: 502 },
    );
  }
  await admin
    .from("user_tags")
    .upsert(
      { user_id: userId, tag_id: tag.id },
      { onConflict: "user_id,tag_id" },
    );
  return NextResponse.json({ tags: await listTags(userId) });
}

const deleteSchema = z.object({ docId: z.string(), tagId: z.string() });

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const userId = await resolveSupabaseUserId(parsed.data.docId);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("user_tags")
    .delete()
    .eq("user_id", userId)
    .eq("tag_id", parsed.data.tagId);
  return NextResponse.json({ tags: await listTags(userId) });
}
