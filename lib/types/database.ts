export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
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
      admins: {
        Row: {
          created_at: string;
          id: number;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          role?: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          role?: Database["public"]["Enums"]["admin_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      content_entries: {
        Row: {
          body: string;
          created_at: string;
          display_order: number;
          id: number;
          title: string;
          type: Database["public"]["Enums"]["content_entries_type"];
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          display_order?: number;
          id?: never;
          title: string;
          type: Database["public"]["Enums"]["content_entries_type"];
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          display_order?: number;
          id?: never;
          title?: string;
          type?: Database["public"]["Enums"]["content_entries_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      draws: {
        Row: {
          bonus_number: number;
          created_at: string;
          first_prize_amount: number;
          first_prize_count: number;
          id: number;
          numbers: number[];
          round: number;
          source: string;
        };
        Insert: {
          bonus_number: number;
          created_at?: string;
          first_prize_amount: number;
          first_prize_count: number;
          id?: never;
          numbers: number[];
          round: number;
          source?: string;
        };
        Update: {
          bonus_number?: number;
          created_at?: string;
          first_prize_amount?: number;
          first_prize_count?: number;
          id?: never;
          numbers?: number[];
          round?: number;
          source?: string;
        };
        Relationships: [];
      };
      dream_journal_entries: {
        Row: {
          created_at: string;
          dream_text: string;
          entry_date: string;
          id: number;
          linked_dream_id: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dream_text: string;
          entry_date: string;
          id?: never;
          linked_dream_id?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dream_text?: string;
          entry_date?: string;
          id?: never;
          linked_dream_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dream_journal_entries_linked_dream_id_fkey";
            columns: ["linked_dream_id"];
            isOneToOne: false;
            referencedRelation: "dreams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dream_journal_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dream_number_mappings: {
        Row: {
          created_at: string;
          dream_id: number;
          id: number;
          numbers: number[];
        };
        Insert: {
          created_at?: string;
          dream_id: number;
          id?: never;
          numbers: number[];
        };
        Update: {
          created_at?: string;
          dream_id?: number;
          id?: never;
          numbers?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "dream_number_mappings_dream_id_fkey";
            columns: ["dream_id"];
            isOneToOne: false;
            referencedRelation: "dreams";
            referencedColumns: ["id"];
          },
        ];
      };
      dream_situations: {
        Row: {
          body: string;
          created_at: string;
          display_order: number;
          dream_id: number;
          id: number;
          key_meaning: string | null;
          keyword: string;
          numbers: number[] | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          display_order?: number;
          dream_id: number;
          id?: never;
          key_meaning?: string | null;
          keyword: string;
          numbers?: number[] | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          display_order?: number;
          dream_id?: number;
          id?: never;
          key_meaning?: string | null;
          keyword?: string;
          numbers?: number[] | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dream_situations_dream_id_fkey";
            columns: ["dream_id"];
            isOneToOne: false;
            referencedRelation: "dreams";
            referencedColumns: ["id"];
          },
        ];
      };
      dreams: {
        Row: {
          category: string | null;
          created_at: string;
          id: number;
          image_url: string | null;
          interpretation: string;
          keyword: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: never;
          image_url?: string | null;
          interpretation: string;
          keyword: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: never;
          image_url?: string | null;
          interpretation?: string;
          keyword?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fortune_results: {
        Row: {
          action_guide: string | null;
          created_at: string;
          id: number;
          input_birth_date: string;
          luck_score: number;
          lucky_color: string | null;
          lucky_direction: string | null;
          lucky_time: string | null;
          money_luck: string | null;
          overall_fortune: string;
          recommended_numbers: number[];
          result_date: string;
          share_id: string;
          things_to_avoid: string | null;
          today_energy: string | null;
          user_id: string | null;
          zodiac_sign: string | null;
        };
        Insert: {
          action_guide?: string | null;
          created_at?: string;
          id?: never;
          input_birth_date: string;
          luck_score: number;
          lucky_color?: string | null;
          lucky_direction?: string | null;
          lucky_time?: string | null;
          money_luck?: string | null;
          overall_fortune: string;
          recommended_numbers: number[];
          result_date: string;
          share_id: string;
          things_to_avoid?: string | null;
          today_energy?: string | null;
          user_id?: string | null;
          zodiac_sign?: string | null;
        };
        Update: {
          action_guide?: string | null;
          created_at?: string;
          id?: never;
          input_birth_date?: string;
          luck_score?: number;
          lucky_color?: string | null;
          lucky_direction?: string | null;
          lucky_time?: string | null;
          money_luck?: string | null;
          overall_fortune?: string;
          recommended_numbers?: number[];
          result_date?: string;
          share_id?: string;
          things_to_avoid?: string | null;
          today_energy?: string | null;
          user_id?: string | null;
          zodiac_sign?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fortune_results_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["notification_deliveries_channel"];
          error_message: string | null;
          id: number;
          notification_id: number;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_deliveries_status"];
        };
        Insert: {
          channel: Database["public"]["Enums"]["notification_deliveries_channel"];
          error_message?: string | null;
          id?: never;
          notification_id: number;
          sent_at?: string | null;
          status: Database["public"]["Enums"]["notification_deliveries_status"];
        };
        Update: {
          channel?: Database["public"]["Enums"]["notification_deliveries_channel"];
          error_message?: string | null;
          id?: never;
          notification_id?: number;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_deliveries_status"];
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: number;
          is_read: boolean;
          link_url: string;
          title: string;
          type: Database["public"]["Enums"]["notifications_type"];
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: never;
          is_read?: boolean;
          link_url: string;
          title: string;
          type: Database["public"]["Enums"]["notifications_type"];
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: never;
          is_read?: boolean;
          link_url?: string;
          title?: string;
          type?: Database["public"]["Enums"]["notifications_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          age_verified: boolean;
          best_win_rank_ever: number | null;
          birth_date: string;
          birth_time: string | null;
          created_at: string;
          gender: Database["public"]["Enums"]["profile_gender"] | null;
          id: string;
          marketing_opt_in: boolean;
          nickname: string;
          privacy_public_default: boolean;
          provider: Database["public"]["Enums"]["profile_provider"];
          status: Database["public"]["Enums"]["profile_status"];
          updated_at: string;
        };
        Insert: {
          age_verified?: boolean;
          best_win_rank_ever?: number | null;
          birth_date: string;
          birth_time?: string | null;
          created_at?: string;
          gender?: Database["public"]["Enums"]["profile_gender"] | null;
          id: string;
          marketing_opt_in?: boolean;
          nickname: string;
          privacy_public_default?: boolean;
          provider: Database["public"]["Enums"]["profile_provider"];
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Update: {
          age_verified?: boolean;
          best_win_rank_ever?: number | null;
          birth_date?: string;
          birth_time?: string | null;
          created_at?: string;
          gender?: Database["public"]["Enums"]["profile_gender"] | null;
          id?: string;
          marketing_opt_in?: boolean;
          nickname?: string;
          privacy_public_default?: boolean;
          provider?: Database["public"]["Enums"]["profile_provider"];
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      share_cards: {
        Row: {
          content_ref_id: number | null;
          content_type: Database["public"]["Enums"]["share_cards_content_type"];
          created_at: string;
          id: number;
          image_url: string | null;
          share_id: string;
          user_id: string | null;
        };
        Insert: {
          content_ref_id?: number | null;
          content_type: Database["public"]["Enums"]["share_cards_content_type"];
          created_at?: string;
          id?: never;
          image_url?: string | null;
          share_id: string;
          user_id?: string | null;
        };
        Update: {
          content_ref_id?: number | null;
          content_type?: Database["public"]["Enums"]["share_cards_content_type"];
          created_at?: string;
          id?: never;
          image_url?: string | null;
          share_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "share_cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      store_win_records: {
        Row: {
          created_at: string;
          id: number;
          prize_rank: number;
          round: number;
          store_id: number;
        };
        Insert: {
          created_at?: string;
          id?: never;
          prize_rank: number;
          round: number;
          store_id: number;
        };
        Update: {
          created_at?: string;
          id?: never;
          prize_rank?: number;
          round?: number;
          store_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "store_win_records_round_fkey";
            columns: ["round"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["round"];
          },
          {
            foreignKeyName: "store_win_records_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          address: string;
          created_at: string;
          id: number;
          lat: number;
          lng: number;
          name: string;
          region_sido: string;
          region_sigungu: string;
          total_first_prize_count: number;
        };
        Insert: {
          address: string;
          created_at?: string;
          id?: never;
          lat: number;
          lng: number;
          name: string;
          region_sido: string;
          region_sigungu: string;
          total_first_prize_count?: number;
        };
        Update: {
          address?: string;
          created_at?: string;
          id?: never;
          lat?: number;
          lng?: number;
          name?: string;
          region_sido?: string;
          region_sigungu?: string;
          total_first_prize_count?: number;
        };
        Relationships: [];
      };
      user_numbers: {
        Row: {
          checked_at: string | null;
          created_at: string;
          generation_method: Database["public"]["Enums"]["user_numbers_generation_method"];
          id: number;
          is_public: boolean;
          is_purchased: boolean;
          match_count: number | null;
          memo: string | null;
          numbers: number[];
          purchase_amount: number;
          recommendation_reason: string | null;
          related_dream_id: number | null;
          related_fortune_id: number | null;
          session_id: string | null;
          target_round: number | null;
          user_id: string | null;
          win_rank: number | null;
        };
        Insert: {
          checked_at?: string | null;
          created_at?: string;
          generation_method: Database["public"]["Enums"]["user_numbers_generation_method"];
          id?: never;
          is_public?: boolean;
          is_purchased?: boolean;
          match_count?: number | null;
          memo?: string | null;
          numbers: number[];
          purchase_amount?: number;
          recommendation_reason?: string | null;
          related_dream_id?: number | null;
          related_fortune_id?: number | null;
          session_id?: string | null;
          target_round?: number | null;
          user_id?: string | null;
          win_rank?: number | null;
        };
        Update: {
          checked_at?: string | null;
          created_at?: string;
          generation_method?: Database["public"]["Enums"]["user_numbers_generation_method"];
          id?: never;
          is_public?: boolean;
          is_purchased?: boolean;
          match_count?: number | null;
          memo?: string | null;
          numbers?: number[];
          purchase_amount?: number;
          recommendation_reason?: string | null;
          related_dream_id?: number | null;
          related_fortune_id?: number | null;
          session_id?: string | null;
          target_round?: number | null;
          user_id?: string | null;
          win_rank?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_numbers_target_round_fkey";
            columns: ["target_round"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["round"];
          },
          {
            foreignKeyName: "user_numbers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_period_stats: {
        Row: {
          best_win_rank: number | null;
          id: number;
          most_frequent_numbers: number[];
          period_key: string;
          period_type: Database["public"]["Enums"]["user_period_stats_period_type"];
          total_generated: number;
          total_purchase_amount: number;
          total_purchased_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          best_win_rank?: number | null;
          id?: never;
          most_frequent_numbers: number[];
          period_key: string;
          period_type: Database["public"]["Enums"]["user_period_stats_period_type"];
          total_generated: number;
          total_purchase_amount: number;
          total_purchased_count: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          best_win_rank?: number | null;
          id?: never;
          most_frequent_numbers?: number[];
          period_key?: string;
          period_type?: Database["public"]["Enums"]["user_period_stats_period_type"];
          total_generated?: number;
          total_purchase_amount?: number;
          total_purchased_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_period_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      winning_cases: {
        Row: {
          created_at: string;
          id: number;
          is_featured: boolean;
          round: number | null;
          story_text: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          is_featured?: boolean;
          round?: number | null;
          story_text: string;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          is_featured?: boolean;
          round?: number | null;
          story_text?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "winning_cases_round_fkey";
            columns: ["round"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["round"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_valid_lotto_numbers: { Args: { numbers: number[] }; Returns: boolean };
      is_valid_partial_lotto_numbers: {
        Args: { numbers: number[] };
        Returns: boolean;
      };
    };
    Enums: {
      admin_role: "super";
      content_entries_type: "faq" | "guide";
      notification_deliveries_channel: "in_app" | "email" | "web_push" | "kakao_alimtalk" | "sms";
      notification_deliveries_status: "pending" | "sent" | "failed";
      notifications_type: "win_result" | "battle_result" | "system" | "marketing";
      profile_gender: "M" | "F" | "N";
      profile_provider: "kakao" | "email";
      profile_status: "active" | "withdrawn" | "suspended";
      share_cards_content_type: "number_result" | "fortune" | "yearly_report";
      user_numbers_generation_method: "auto" | "custom" | "dream" | "fortune";
      user_period_stats_period_type: "monthly" | "yearly";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {
      admin_role: ["super"],
      content_entries_type: ["faq", "guide"],
      notification_deliveries_channel: ["in_app", "email", "web_push", "kakao_alimtalk", "sms"],
      notification_deliveries_status: ["pending", "sent", "failed"],
      notifications_type: ["win_result", "battle_result", "system", "marketing"],
      profile_gender: ["M", "F", "N"],
      profile_provider: ["kakao", "email"],
      profile_status: ["active", "withdrawn", "suspended"],
      share_cards_content_type: ["number_result", "fortune", "yearly_report"],
      user_numbers_generation_method: ["auto", "custom", "dream", "fortune"],
      user_period_stats_period_type: ["monthly", "yearly"],
    },
  },
} as const;
