"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

import { ensureAnonSession } from "../auth";

/**
 * Generic content favorites/saves over the Supabase RLS client
 * (`public.content_favorites`), working across EVERY content collection
 * (posts/videos/audio/photos/locations/events) keyed by `collection:item_id`.
 *
 * The first save **mints an anonymous account** (`ensureAnonSession`) so the
 * favorite persists before sign-up — later converted to a permanent account at
 * checkout. `content_favorites` is the one table anonymous users may write
 * (own-row RLS), so this works for logged-out visitors without the CMS bridge.
 */

const KEY = ["content-favorites"] as const;

/** Stable key for a favorited item across collections. */
export function favoriteKey(collection: string, itemId: string): string {
  return `${collection}:${itemId}`;
}

export interface ToggleFavoriteInput {
  /** Payload collection slug (e.g. "posts", "videos"). */
  collection: string;
  /** Content doc id. */
  itemId: string;
  /** Desired state after the toggle: true = save, false = unsave. */
  favorited: boolean;
  /**
   * Cloudflare Turnstile token — required to mint a new anonymous session when
   * Supabase CAPTCHA is enabled (see docs/TURNSTILE.md). Unused once a session
   * already exists.
   */
  captchaToken?: string;
}

/**
 * The set of `collection:item_id` keys the current user has favorited (RLS: own
 * only). Pass `collection` to scope to a single collection. Logged-out visitors
 * resolve to an empty set without a round-trip (an anon account is only minted
 * on first save).
 */
export function useFavorites(collection?: string) {
  const supabase = useSupabase();
  const { user, isLoading } = useSession();

  return useQuery({
    queryKey: [...KEY, user?.id ?? null, collection ?? null],
    enabled: !isLoading,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return new Set<string>();
      let q = supabase.from("content_favorites").select("collection, item_id");
      if (collection) q = q.eq("collection", collection);
      const { data, error } = await q;
      if (error) throw error;
      return new Set(data.map((r) => favoriteKey(r.collection, r.item_id)));
    },
  });
}

/** Save/unsave a content item; mints an anonymous account on the first save. */
export function useToggleFavorite() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collection,
      itemId,
      favorited,
      captchaToken,
    }: ToggleFavoriteInput) => {
      const userId = (await ensureAnonSession(supabase, { captchaToken })).id;
      if (favorited) {
        const { error } = await supabase
          .from("content_favorites")
          .upsert(
            { user_id: userId, collection, item_id: itemId },
            { onConflict: "user_id,collection,item_id" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("content_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("collection", collection)
          .eq("item_id", itemId);
        if (error) throw error;
      }
      return { collection, itemId, favorited };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
