import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@acme/api/types";

import { clientEnv } from "./env";

/**
 * Native Supabase client. Sessions persist via AsyncStorage and auto-refresh.
 * (AsyncStorage rather than expo-secure-store: Supabase session payloads can
 * exceed SecureStore's 2 KB per-value limit.)
 */
export const supabase = createClient<Database>(
  clientEnv.SUPABASE_URL,
  clientEnv.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE so email links (confirmation / magic link / recovery) and OAuth
      // redirect back with a ?code= the app exchanges in /auth-callback.
      // The verifier lives in this app's storage, so those links only complete
      // on this device — the manual confirmation code is the fallback.
      flowType: "pkce",
    },
  },
);
