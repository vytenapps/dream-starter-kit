export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ext_billing_customers: {
        Row: {
          created_at: string;
          id: string;
          stripe_customer_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          stripe_customer_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          stripe_customer_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_billing_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_billing_prices: {
        Row: {
          active: boolean;
          created_at: string;
          currency: string | null;
          id: string;
          interval: string | null;
          interval_count: number | null;
          metadata: Json | null;
          product_id: string | null;
          type: string | null;
          unit_amount: number | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          currency?: string | null;
          id: string;
          interval?: string | null;
          interval_count?: number | null;
          metadata?: Json | null;
          product_id?: string | null;
          type?: string | null;
          unit_amount?: number | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          currency?: string | null;
          id?: string;
          interval?: string | null;
          interval_count?: number | null;
          metadata?: Json | null;
          product_id?: string | null;
          type?: string | null;
          unit_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ext_billing_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "ext_billing_products";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_billing_products: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          image: string | null;
          metadata: Json | null;
          name: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id: string;
          image?: string | null;
          metadata?: Json | null;
          name?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          image?: string | null;
          metadata?: Json | null;
          name?: string | null;
        };
        Relationships: [];
      };
      ext_billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          id: string;
          price_id: string | null;
          quantity: number | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id: string;
          price_id?: string | null;
          quantity?: number | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          price_id?: string | null;
          quantity?: number | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_billing_subscriptions_price_id_fkey";
            columns: ["price_id"];
            isOneToOne: false;
            referencedRelation: "ext_billing_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ext_billing_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_chat_documents: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          kind: string;
          title: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          title: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_chat_documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_chat_messages: {
        Row: {
          attachments: Json;
          content: string;
          created_at: string;
          id: string;
          parts: Json | null;
          role: string;
          thread_id: string;
          token_usage: Json | null;
        };
        Insert: {
          attachments?: Json;
          content?: string;
          created_at?: string;
          id?: string;
          parts?: Json | null;
          role: string;
          thread_id: string;
          token_usage?: Json | null;
        };
        Update: {
          attachments?: Json;
          content?: string;
          created_at?: string;
          id?: string;
          parts?: Json | null;
          role?: string;
          thread_id?: string;
          token_usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "ext_chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ext_chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_chat_suggestions: {
        Row: {
          created_at: string;
          description: string | null;
          document_created_at: string;
          document_id: string;
          id: string;
          is_resolved: boolean;
          original_text: string;
          suggested_text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          document_created_at: string;
          document_id: string;
          id?: string;
          is_resolved?: boolean;
          original_text: string;
          suggested_text: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          document_created_at?: string;
          document_id?: string;
          id?: string;
          is_resolved?: boolean;
          original_text?: string;
          suggested_text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_chat_suggestions_document_id_document_created_at_fkey";
            columns: ["document_id", "document_created_at"];
            isOneToOne: false;
            referencedRelation: "ext_chat_documents";
            referencedColumns: ["id", "created_at"];
          },
          {
            foreignKeyName: "ext_chat_suggestions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_chat_threads: {
        Row: {
          active_skill_slug: string | null;
          active_skill_turns_remaining: number;
          created_at: string;
          id: string;
          last_context: Json | null;
          title: string | null;
          updated_at: string;
          user_id: string;
          visibility: string;
        };
        Insert: {
          active_skill_slug?: string | null;
          active_skill_turns_remaining?: number;
          created_at?: string;
          id?: string;
          last_context?: Json | null;
          title?: string | null;
          updated_at?: string;
          user_id: string;
          visibility?: string;
        };
        Update: {
          active_skill_slug?: string | null;
          active_skill_turns_remaining?: number;
          created_at?: string;
          id?: string;
          last_context?: Json | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_chat_threads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_chat_votes: {
        Row: {
          is_upvoted: boolean;
          message_id: string;
          thread_id: string;
        };
        Insert: {
          is_upvoted: boolean;
          message_id: string;
          thread_id: string;
        };
        Update: {
          is_upvoted?: boolean;
          message_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_chat_votes_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ext_chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ext_chat_votes_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "ext_chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_notifications: {
        Row: {
          body: string | null;
          created_at: string;
          data: Json;
          id: string;
          read_at: string | null;
          title: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_notifications_push_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_notifications_push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ext_reminders: {
        Row: {
          channel: string;
          created_at: string;
          due_at: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          due_at: string;
          id?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          due_at?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ext_reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          bucket: string;
          created_at: string;
          id: string;
          mime_type: string | null;
          path: string;
          size_bytes: number | null;
          user_id: string;
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          id?: string;
          mime_type?: string | null;
          path: string;
          size_bytes?: number | null;
          user_id: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: string;
          mime_type?: string | null;
          path?: string;
          size_bytes?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          org_id: string;
          role: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          org_id: string;
          role?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          org_id?: string;
          role?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_staff: boolean;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_staff?: boolean;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_staff?: boolean;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          is_system: boolean;
          name: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      user_tags: {
        Row: {
          created_at: string;
          id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          tag_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          tag_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_org_admin: { Args: { _org: string }; Returns: boolean };
      is_org_member: { Args: { _org: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
