"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession, useSupabase } from "@acme/api";

const threadsKey = ["chat-threads"] as const;
const messagesKey = (threadId: string) => ["chat-messages", threadId] as const;

/** List the user's chat threads (RLS: own). */
export function useChatThreads() {
  const supabase = useSupabase();
  const { user } = useSession();

  return useQuery({
    queryKey: threadsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ext_chat_threads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateThread() {
  const supabase = useSupabase();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title?: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("ext_chat_threads")
        .insert({ user_id: user.id, title: title ?? "New chat" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });
}

export function useDeleteThread() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ext_chat_threads")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });
}

/** Messages in a thread (RLS: reachable only via a thread you own). */
export function useThreadMessages(threadId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: messagesKey(threadId),
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ext_chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Send a message to the AI route, which persists the user + assistant turns
 * (then we refetch). `apiBaseUrl` is "" on web (same origin) and the API origin
 * on native (EXPO_PUBLIC_API_URL). The route streams; this client awaits the
 * persisted result — swap in @ai-sdk/react useChat for live token streaming.
 */
export function useSendMessage(threadId: string, apiBaseUrl = "") {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (text: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(`${apiBaseUrl}/api/ext/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ threadId, text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Chat request failed");
      }
      return (await res.json()) as {
        message: { role: string; content: string };
      };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: messagesKey(threadId) }),
  });
}
