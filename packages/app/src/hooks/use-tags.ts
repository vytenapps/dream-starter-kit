"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

export interface UserTag {
  id: string;
  name: string;
  color: string | null;
}

/**
 * The current user's tags (RLS: read-own). Tags are assigned server-side — the
 * Stripe webhook adds a plan-name tag, and staff can add custom tags from the
 * admin — so this hook is read-only. Two small reads (links → definitions) keep
 * it fully typed without relying on embedded-join type inference.
 */
export function useUserTags() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: ["user-tags", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserTag[]> => {
      const { data: links, error: linkErr } = await supabase
        .from("user_tags")
        .select("tag_id");
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l) => l.tag_id);
      if (ids.length === 0) return [];

      const { data: tags, error: tagErr } = await supabase
        .from("tags")
        .select("id, name, color")
        .in("id", ids)
        .order("name");
      if (tagErr) throw tagErr;
      return tags ?? [];
    },
  });
}
