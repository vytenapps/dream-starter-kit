"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

import type { UpdateProfileInput } from "../validators/auth";

/** Read the current user's profile row (RLS: own only). */
export function useProfile() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Update the current user's display name / avatar. */
export function useUpdateProfile() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: input.displayName,
          avatar_url: input.avatarUrl?.length ? input.avatarUrl : null,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}
