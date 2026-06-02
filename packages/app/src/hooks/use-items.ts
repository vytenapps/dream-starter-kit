"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TablesInsert } from "@acme/api";
import { useSession, useSupabase } from "@acme/api";

import type { CreateItemInput, UpdateItemInput } from "../validators/item";

const itemsKey = (projectId: string) => ["items", projectId] as const;

/** List items in a project (RLS: visible if you can access the project). */
export function useItems(projectId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: itemsKey(projectId),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateItem(projectId: string) {
  const supabase = useSupabase();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput) => {
      if (!user) throw new Error("Not authenticated");
      const payload: TablesInsert<"items"> = {
        project_id: projectId,
        created_by: user.id,
        title: input.title,
        status: input.status,
      };
      const { data, error } = await supabase
        .from("items")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itemsKey(projectId) }),
  });
}

export function useUpdateItem(projectId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateItemInput & { id: string }) => {
      const { data, error } = await supabase
        .from("items")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itemsKey(projectId) }),
  });
}

export function useDeleteItem(projectId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: itemsKey(projectId) }),
  });
}
