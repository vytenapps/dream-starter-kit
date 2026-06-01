/**
 * @acme/api — the shared Supabase data layer.
 *
 * Exposes the cross-platform provider + react-query wiring and shared data
 * hooks. Each app injects its own platform Supabase client (web: @supabase/ssr;
 * native: createClient + AsyncStorage). Feature-specific hooks (Phase 4+) live
 * alongside this as the kit grows.
 */

export {
  SupabaseProvider,
  useSupabase,
  createQueryClient,
  type AppSupabaseClient,
  type SupabaseProviderProps,
} from "./provider";

export { useSession, type SessionState } from "./hooks";

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./types";
