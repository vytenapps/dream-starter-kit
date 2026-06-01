/**
 * Generated Supabase database types.
 *
 * PLACEHOLDER — Phase 2 creates the schema and regenerates this file via:
 *   pnpm db:gen-types
 * which runs `supabase gen types typescript`. Until then this is an empty
 * (but structurally valid) `Database` so `SupabaseClient<Database>` typechecks.
 * Do not hand-edit once generation is wired up.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Convenience helper for a table's Row type once types are generated. */
export type Tables<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T] extends { Row: infer R } ? R : never;
