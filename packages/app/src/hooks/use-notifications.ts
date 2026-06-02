"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

const notificationsKey = ["notifications"] as const;

/** The user's in-app notification feed (RLS: own). */
export function useNotifications() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: notificationsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount(): number {
  const notifications = useNotifications();
  return notifications.data?.filter((n) => !n.read_at).length ?? 0;
}

export function useMarkNotificationRead() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}
