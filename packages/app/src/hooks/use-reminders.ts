"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TablesInsert } from "@acme/api";
import { useSession, useSupabase } from "@acme/api";

import type { CreateReminderInput } from "../validators/reminder";

const remindersKey = ["reminders"] as const;

/** The user's reminders (RLS: own). */
export function useReminders() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: remindersKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateReminder() {
  const supabase = useSupabase();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      if (!user) throw new Error("Not authenticated");
      const payload: TablesInsert<"reminders"> = {
        user_id: user.id,
        due_at: input.dueAt,
        channel: input.channel,
        item_id: input.itemId ?? null,
      };
      const { data, error } = await supabase
        .from("reminders")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remindersKey }),
  });
}

export function useDeleteReminder() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remindersKey }),
  });
}
