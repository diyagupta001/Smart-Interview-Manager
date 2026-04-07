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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      interview_answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          interview_id: string
          question_id: string
          time_taken_seconds: number
        }
        Insert: {
          answer_text?: string
          created_at?: string
          id?: string
          interview_id: string
          question_id: string
          time_taken_seconds?: number
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          interview_id?: string
          question_id?: string
          time_taken_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "interview_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_links: {
        Row: {
          candidate_email: string | null
          candidate_name: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          job_role_id: string
          token: string
          used: boolean
        }
        Insert: {
          candidate_email?: string | null
          candidate_name?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          job_role_id: string
          token?: string
          used?: boolean
        }
        Update: {
          candidate_email?: string | null
          candidate_name?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          job_role_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "interview_links_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          interview_id: string
          question_order: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          interview_id: string
          question_order?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          interview_id?: string
          question_order?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_scores: {
        Row: {
          ai_feedback: string | null
          communication_score: number
          confidence_score: number
          created_at: string
          decision: Database["public"]["Enums"]["interview_decision"]
          id: string
          interview_id: string
          overall_rating: number
          technical_score: number
        }
        Insert: {
          ai_feedback?: string | null
          communication_score?: number
          confidence_score?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["interview_decision"]
          id?: string
          interview_id: string
          overall_rating?: number
          technical_score?: number
        }
        Update: {
          ai_feedback?: string | null
          communication_score?: number
          confidence_score?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["interview_decision"]
          id?: string
          interview_id?: string
          overall_rating?: number
          technical_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "interview_scores_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_violations: {
        Row: {
          created_at: string
          description: string
          id: string
          interview_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          interview_id: string
          violation_type: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          interview_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_violations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_email: string | null
          candidate_name: string
          completed_at: string | null
          created_at: string
          flagged: boolean
          id: string
          link_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          tab_switch_count: number
          updated_at: string
        }
        Insert: {
          candidate_email?: string | null
          candidate_name?: string
          completed_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          link_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          tab_switch_count?: number
          updated_at?: string
        }
        Update: {
          candidate_email?: string | null
          candidate_name?: string
          completed_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          link_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          tab_switch_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "interview_links"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          created_at: string
          created_by: string
          description: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          is_active: boolean
          question_count: number
          required_skills: string[]
          time_per_question: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_active?: boolean
          question_count?: number
          required_skills?: string[]
          time_per_question?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          is_active?: boolean
          question_count?: number
          required_skills?: string[]
          time_per_question?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hr"
      difficulty_level: "easy" | "medium" | "hard"
      interview_decision: "selected" | "rejected" | "pending"
      interview_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "auto_submitted"
      question_type: "technical" | "hr" | "scenario"
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
      app_role: ["admin", "hr"],
      difficulty_level: ["easy", "medium", "hard"],
      interview_decision: ["selected", "rejected", "pending"],
      interview_status: [
        "pending",
        "in_progress",
        "completed",
        "auto_submitted",
      ],
      question_type: ["technical", "hr", "scenario"],
    },
  },
} as const
