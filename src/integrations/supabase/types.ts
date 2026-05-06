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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          content: string
          content_en: string
          content_ru: string
          created_at: string
          hidden: boolean
          id: string
          meta_description: string
          meta_description_en: string
          meta_description_ru: string
          published_at: string | null
          seo_keywords: string[]
          seo_keywords_en: string[]
          seo_keywords_ru: string[]
          slug: string | null
          status: string
          title: string
          title_en: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          content?: string
          content_en?: string
          content_ru?: string
          created_at?: string
          hidden?: boolean
          id?: string
          meta_description?: string
          meta_description_en?: string
          meta_description_ru?: string
          published_at?: string | null
          seo_keywords?: string[]
          seo_keywords_en?: string[]
          seo_keywords_ru?: string[]
          slug?: string | null
          status?: string
          title?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_en?: string
          content_ru?: string
          created_at?: string
          hidden?: boolean
          id?: string
          meta_description?: string
          meta_description_en?: string
          meta_description_ru?: string
          published_at?: string | null
          seo_keywords?: string[]
          seo_keywords_en?: string[]
          seo_keywords_ru?: string[]
          slug?: string | null
          status?: string
          title?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_history: {
        Row: {
          action: string
          changed_at: string
          id: string
          record_id: string
          snapshot: Json
          table_name: string
        }
        Insert: {
          action?: string
          changed_at?: string
          id?: string
          record_id: string
          snapshot: Json
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          id?: string
          record_id?: string
          snapshot?: Json
          table_name?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          answer_en: string
          answer_ru: string
          created_at: string
          id: string
          question: string
          question_en: string
          question_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          answer_en?: string
          answer_ru?: string
          created_at?: string
          id?: string
          question: string
          question_en?: string
          question_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          answer_en?: string
          answer_ru?: string
          created_at?: string
          id?: string
          question?: string
          question_en?: string
          question_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      page_images: {
        Row: {
          alt_text: string
          collection_key: string
          created_at: string
          id: string
          image_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          alt_text?: string
          collection_key: string
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          alt_text?: string
          collection_key?: string
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          badge_color: string
          badge_text: string
          badge_text_en: string
          badge_text_ru: string
          created_at: string
          ends_at: string
          id: string
          service_id: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          badge_color?: string
          badge_text?: string
          badge_text_en?: string
          badge_text_ru?: string
          created_at?: string
          ends_at: string
          id?: string
          service_id: string
          starts_at?: string
        }
        Update: {
          active?: boolean
          badge_color?: string
          badge_text?: string
          badge_text_en?: string
          badge_text_ru?: string
          created_at?: string
          ends_at?: string
          id?: string
          service_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string
          description_en: string
          description_ru: string
          duration: string
          duration_en: string
          duration_ru: string
          hidden: boolean
          hide_duration: boolean
          hide_price: boolean
          hide_price_from: boolean
          id: string
          price: string
          price_en: string
          price_ru: string
          sort_order: number
          title: string
          title_en: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          description_en?: string
          description_ru?: string
          duration: string
          duration_en?: string
          duration_ru?: string
          hidden?: boolean
          hide_duration?: boolean
          hide_price?: boolean
          hide_price_from?: boolean
          id?: string
          price: string
          price_en?: string
          price_ru?: string
          sort_order?: number
          title: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          description_en?: string
          description_ru?: string
          duration?: string
          duration_en?: string
          duration_ru?: string
          hidden?: boolean
          hide_duration?: boolean
          hide_price?: boolean
          hide_price_from?: boolean
          id?: string
          price?: string
          price_en?: string
          price_ru?: string
          sort_order?: number
          title?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          category: string
          content_key: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          value_en: string
          value_es: string
          value_ru: string
        }
        Insert: {
          category?: string
          content_key: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value_en?: string
          value_es?: string
          value_ru?: string
        }
        Update: {
          category?: string
          content_key?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value_en?: string
          value_es?: string
          value_ru?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          name: string
          quote: string
          quote_en: string
          quote_ru: string
          rating: number
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          name: string
          quote: string
          quote_en?: string
          quote_ru?: string
          rating?: number
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          name?: string
          quote?: string
          quote_en?: string
          quote_ru?: string
          rating?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
