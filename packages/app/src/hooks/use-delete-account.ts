"use client";

import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "@acme/api";

/**
 * Permanently delete the signed-in user's account. Invokes the `delete-account`
 * edge function (which uses the service role to delete auth.users — the DB
 * cascade removes all owned rows), then signs out locally.
 *
 * App Store requirement: account deletion must be available in-app.
 */
export function useDeleteAccount() {
  const supabase = useSupabase();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // invoke() attaches the user's access token automatically. supabase-js
      // types `functions.invoke` loosely (it resolves to `any`); the response
      // is `{ data, error }`.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;

      await supabase.auth.signOut();
    },
  });
}
