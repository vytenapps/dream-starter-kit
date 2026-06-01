"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Database } from "./types";

/** The app's Supabase client, typed against the generated DB schema. */
export type AppSupabaseClient = SupabaseClient<Database>;

const SupabaseContext = createContext<AppSupabaseClient | null>(null);

/** Shared react-query client factory (sensible defaults for web + native). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

export interface SupabaseProviderProps {
  /**
   * The platform Supabase client. Each app injects its own:
   * - web: `@supabase/ssr` browser client (cookie-based)
   * - native: `createClient` with an AsyncStorage auth adapter
   */
  client: AppSupabaseClient;
  /** Optional shared QueryClient (one is created if omitted). */
  queryClient?: QueryClient;
  children: ReactNode;
}

/**
 * Cross-platform data provider: makes the Supabase client available to shared
 * hooks (packages/app) and wires up react-query. Render once near the root of
 * each app.
 */
export function SupabaseProvider({
  client,
  queryClient,
  children,
}: SupabaseProviderProps) {
  const [qc] = useState(() => queryClient ?? createQueryClient());
  return (
    <SupabaseContext.Provider value={client}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </SupabaseContext.Provider>
  );
}

/** Access the Supabase client from within a `<SupabaseProvider>`. */
export function useSupabase(): AppSupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error("useSupabase must be used within a <SupabaseProvider>");
  }
  return client;
}
