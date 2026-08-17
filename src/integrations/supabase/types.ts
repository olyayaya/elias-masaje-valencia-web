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
          slug_en: string | null
          slug_es: string | null
          slug_ru: string | null
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
          slug_en?: string | null
          slug_es?: string | null
          slug_ru?: string | null
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
          slug_en?: string | null
          slug_es?: string | null
          slug_ru?: string | null
          status?: string
          title?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_leads: {
        Row: {
          created_at: string
          duration: string | null
          id: string
          locale: string | null
          location: string | null
          message: string
          name: string
          page_path: string | null
          phone: string
          preferred_time: string
          price: string | null
          service: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: string | null
          id?: string
          locale?: string | null
          location?: string | null
          message: string
          name: string
          page_path?: string | null
          phone: string
          preferred_time: string
          price?: string | null
          service: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: string | null
          id?: string
          locale?: string | null
          location?: string | null
          message?: string
          name?: string
          page_path?: string | null
          phone?: string
          preferred_time?: string
          price?: string | null
          service?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          record_id: string
          snapshot: Json
          table_name: string
        }
        Insert: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          record_id: string
          snapshot: Json
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          record_id?: string
          snapshot?: Json
          table_name?: string
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          locale: string
          location: string
          metadata: Json
          page_path: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          locale?: string
          location?: string
          metadata?: Json
          page_path?: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          locale?: string
          location?: string
          metadata?: Json
          page_path?: string
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
      media_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_name: string
          old_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_name: string
          old_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_name?: string
          old_name?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_media_history_refs: { Args: { _needle: string }; Returns: number }
      current_actor: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rewrite_media_references: {
        Args: {
          _actor: string
          _new: string
          _new_enc: string
          _old: string
          _old_enc: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
