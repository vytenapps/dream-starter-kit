/**
 * Supabase database types for the `public` schema.
 *
 * Authored to mirror supabase/migrations exactly (same nullability/optionality
 * rules `supabase gen types` applies). It is the generated-equivalent: once you
 * can run a local Supabase (Docker), refresh it with `pnpm db:gen-types`, which
 * overwrites this file. Do not hand-edit thereafter.
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
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: { id: string; name: string; owner_id: string; created_at: string };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          active: boolean;
          name: string | null;
          description: string | null;
          image: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id: string;
          active?: boolean;
          name?: string | null;
          description?: string | null;
          image?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          active?: boolean;
          name?: string | null;
          description?: string | null;
          image?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      prices: {
        Row: {
          id: string;
          product_id: string | null;
          active: boolean;
          unit_amount: number | null;
          currency: string | null;
          type: string | null;
          interval: string | null;
          interval_count: number | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id: string;
          product_id?: string | null;
          active?: boolean;
          unit_amount?: number | null;
          currency?: string | null;
          type?: string | null;
          interval?: string | null;
          interval_count?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          active?: boolean;
          unit_amount?: number | null;
          currency?: string | null;
          type?: string | null;
          interval?: string | null;
          interval_count?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          price_id: string | null;
          status: string | null;
          quantity: number | null;
          cancel_at_period_end: boolean;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          price_id?: string | null;
          status?: string | null;
          quantity?: number | null;
          cancel_at_period_end?: boolean;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          price_id?: string | null;
          status?: string | null;
          quantity?: number | null;
          cancel_at_period_end?: boolean;
          current_period_end?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          due_at: string;
          channel: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          due_at: string;
          channel?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          due_at?: string;
          channel?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string | null;
          body: string | null;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title?: string | null;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string | null;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          user_id: string;
          bucket: string;
          path: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bucket?: string;
          path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bucket?: string;
          path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          token_usage: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: string;
          content?: string;
          token_usage?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          role?: string;
          content?: string;
          token_usage?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type PublicSchema = Database["public"];

/** Row type for a public table, e.g. `Tables<"reminders">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

/** Insert type for a public table, e.g. `TablesInsert<"reminders">`. */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

/** Update type for a public table, e.g. `TablesUpdate<"reminders">`. */
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
