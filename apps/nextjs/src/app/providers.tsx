"use client";

import { useState } from "react";

import { SupabaseProvider } from "@acme/api";

import { createClient } from "~/lib/supabase/client";

/**
 * Client-side providers. Creates the browser Supabase client once and shares it
 * (plus react-query) with the rest of the app via `@acme/api`'s provider.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createClient());
  return <SupabaseProvider client={client}>{children}</SupabaseProvider>;
}
