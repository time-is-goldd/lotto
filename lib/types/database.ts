export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      draws: {
        Row: {
          bonus_number: number
          created_at: string
          first_prize_amount: number
          first_prize_count: number
          id: number
          numbers: number[]
          round: number
          source: string
        }
        Insert: {
          bonus_number: number
          created_at?: string
          first_prize_amount: number
          first_prize_count: number
          id?: never
          numbers: number[]
          round: number
          source?: string
        }
        Update: {
          bonus_number?: number
          created_at?: string
          first_prize_amount?: number
          first_prize_count?: number
          id?: never
          numbers?: number[]
          round?: number
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_verified: boolean
          best_win_rank_ever: number | null
          birth_date: string
          birth_time: string | null
          created_at: string
          gender: Database["public"]["Enums"]["profile_gender"] | null
          id: string
          marketing_opt_in: boolean
          nickname: string
          privacy_public_default: boolean
          provider: Database["public"]["Enums"]["profile_provider"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          age_verified?: boolean
          best_win_rank_ever?: number | null
          birth_date: string
          birth_time?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          id: string
          marketing_opt_in?: boolean
          nickname: string
          privacy_public_default?: boolean
          provider: Database["public"]["Enums"]["profile_provider"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          age_verified?: boolean
          best_win_rank_ever?: number | null
          birth_date?: string
          birth_time?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          id?: string
          marketing_opt_in?: boolean
          nickname?: string
          privacy_public_default?: boolean
          provider?: Database["public"]["Enums"]["profile_provider"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_numbers: {
        Row: {
          checked_at: string | null
          created_at: string
          generation_method: Database["public"]["Enums"]["user_numbers_generation_method"]
          id: number
          is_public: boolean
          is_purchased: boolean
          match_count: number | null
          memo: string | null
          numbers: number[]
          purchase_amount: number
          recommendation_reason: string | null
          related_dream_id: number | null
          related_fortune_id: number | null
          session_id: string | null
          target_round: number | null
          user_id: string | null
          win_rank: number | null
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          generation_method: Database["public"]["Enums"]["user_numbers_generation_method"]
          id?: never
          is_public?: boolean
          is_purchased?: boolean
          match_count?: number | null
          memo?: string | null
          numbers: number[]
          purchase_amount?: number
          recommendation_reason?: string | null
          related_dream_id?: number | null
          related_fortune_id?: number | null
          session_id?: string | null
          target_round?: number | null
          user_id?: string | null
          win_rank?: number | null
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          generation_method?: Database["public"]["Enums"]["user_numbers_generation_method"]
          id?: never
          is_public?: boolean
          is_purchased?: boolean
          match_count?: number | null
          memo?: string | null
          numbers?: number[]
          purchase_amount?: number
          recommendation_reason?: string | null
          related_dream_id?: number | null
          related_fortune_id?: number | null
          session_id?: string | null
          target_round?: number | null
          user_id?: string | null
          win_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_numbers_target_round_fkey"
            columns: ["target_round"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["round"]
          },
          {
            foreignKeyName: "user_numbers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_valid_lotto_numbers: { Args: { numbers: number[] }; Returns: boolean }
    }
    Enums: {
      profile_gender: "M" | "F" | "N"
      profile_provider: "kakao" | "email"
      profile_status: "active" | "withdrawn" | "suspended"
      user_numbers_generation_method: "auto" | "custom" | "dream" | "fortune"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      profile_gender: ["M", "F", "N"],
      profile_provider: ["kakao", "email"],
      profile_status: ["active", "withdrawn", "suspended"],
      user_numbers_generation_method: ["auto", "custom", "dream", "fortune"],
    },
  },
} as const
