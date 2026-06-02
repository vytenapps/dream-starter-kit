"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TablesInsert } from "@acme/api";
import { useSession, useSupabase } from "@acme/api";

import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../validators/project";

const projectsKey = ["projects"] as const;

/** List the current user's projects (RLS: owner or org member). */
export function useProjects() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: projectsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Read a single project by id. */
export function useProject(id: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProject() {
  const supabase = useSupabase();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!user) throw new Error("Not authenticated");
      const payload: TablesInsert<"projects"> = {
        name: input.name,
        owner_id: user.id,
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useUpdateProject() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProjectInput & { id: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useDeleteProject() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}
