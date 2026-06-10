import type { AuthStrategy } from "payload";

import { createClient } from "~/lib/supabase/server";

/**
 * Supabase -> Payload SSO bridge.
 *
 * Payload authenticates every CMS request from the caller's existing **Supabase**
 * session — there is no separate Payload login or `payload-token`. This runs in the
 * Next.js server (NOT as the least-privilege `payload_cms` DB role): it reads the
 * Supabase session + `profiles.is_staff` via the normal Supabase client (anon key +
 * the user's own JWT, RLS read-own), and provisions the `cms.users` row via Payload's
 * Local API. So the kit's schema isolation (payload_cms touches only `cms`) holds.
 *
 * Authorization is default-deny: only app users flagged `is_staff` (the first signup,
 * plus anyone an admin promotes) are mapped to a Payload admin. Everyone else gets no
 * CMS access.
 */
export const SUPABASE_STRATEGY_NAME = "supabase";

export const supabaseStrategy: AuthStrategy = {
  name: SUPABASE_STRATEGY_NAME,
  authenticate: async ({ payload }) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null };

    // Authorization gate: only staff app users may enter the CMS.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("id", user.id)
      .single();
    if (!profile?.is_staff) return { user: null };

    const findBySupabaseId = async () => {
      // `trash: true` includes soft-deleted rows: a trashed user must be
      // rejected (not silently re-created, which would trip the unique
      // supabaseUserId constraint).
      const { docs } = await payload.find({
        collection: "users",
        where: { supabaseUserId: { equals: user.id } },
        limit: 1,
        trash: true,
        overrideAccess: true,
      });
      return docs[0];
    };

    // JIT-provision the cms.users row, keyed by the stable Supabase user id.
    let cmsUser = await findBySupabaseId();
    if (!cmsUser) {
      const name =
        (user.user_metadata.display_name as string | undefined) ??
        (user.user_metadata.name as string | undefined) ??
        user.email?.split("@")[0];
      try {
        cmsUser = await payload.create({
          collection: "users",
          data: {
            supabaseUserId: user.id,
            email: user.email ?? `${user.id}@users.noreply.local`,
            name,
            roles: ["admin"],
          },
          overrideAccess: true,
        });
      } catch {
        // Lost a concurrent create race (unique supabaseUserId) — re-find.
        cmsUser = await findBySupabaseId();
      }
    }
    if (!cmsUser) return { user: null };

    // Soft-deleted (trashed) users are locked out until restored from the
    // admin Trash view — even if their profile is still flagged staff.
    if (cmsUser.deletedAt) return { user: null };

    // A mirrored member who has since been granted staff (profiles.is_staff)
    // gets a CMS staff role on first admin visit, so role-based access
    // (access.admin, isStaff) lines up with the Supabase-side grant.
    if (!cmsUser.roles.some((r) => ["admin", "editor", "author"].includes(r))) {
      cmsUser = await payload.update({
        collection: "users",
        id: cmsUser.id,
        data: { roles: [...cmsUser.roles, "editor"] },
        overrideAccess: true,
      });
    }

    return { user: { ...cmsUser, collection: "users" as const } };
  },
};
