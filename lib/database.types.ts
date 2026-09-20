export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      athletes: {
        Row: {
          belt_rank: string | null
          club_entry_id: string
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          weight: number | null
        }
        Insert: {
          belt_rank?: string | null
          club_entry_id: string
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id?: string
          weight?: number | null
        }
        Update: {
          belt_rank?: string | null
          club_entry_id?: string
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_club_entry_id_fkey"
            columns: ["club_entry_id"]
            isOneToOne: false
            referencedRelation: "club_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          changes: Json
          created_at: string
          event_id: string
          id: string
          reason: string
          subject_id: string
        }
        Insert: {
          action: string
          actor_id: string
          changes: Json
          created_at?: string
          event_id: string
          id?: string
          reason: string
          subject_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          changes?: Json
          created_at?: string
          event_id?: string
          id?: string
          reason?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      brackets: {
        Row: {
          category_id: string
          created_at: string
          format: string
          id: string
          repechage: boolean
          rounds: number | null
          status: string
        }
        Insert: {
          category_id: string
          created_at?: string
          format: string
          id?: string
          repechage?: boolean
          rounds?: number | null
          status?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          format?: string
          id?: string
          repechage?: boolean
          rounds?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brackets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          age_max: number | null
          age_min: number | null
          belt_max: string | null
          belt_min: string | null
          bracket_format: string | null
          created_at: string
          discipline: string
          event_id: string
          gender: string | null
          id: string
          judge_panel: number
          label: string
          match_seconds: number | null
          scoring_mode: string | null
          sequence: number | null
          status: string
          tatami_id: string | null
          weight_max: number | null
          weight_min: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          belt_max?: string | null
          belt_min?: string | null
          bracket_format?: string | null
          created_at?: string
          discipline: string
          event_id: string
          gender?: string | null
          id?: string
          judge_panel?: number
          label: string
          match_seconds?: number | null
          scoring_mode?: string | null
          sequence?: number | null
          status?: string
          tatami_id?: string | null
          weight_max?: number | null
          weight_min?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          belt_max?: string | null
          belt_min?: string | null
          bracket_format?: string | null
          created_at?: string
          discipline?: string
          event_id?: string
          gender?: string | null
          id?: string
          judge_panel?: number
          label?: string
          match_seconds?: number | null
          scoring_mode?: string | null
          sequence?: number | null
          status?: string
          tatami_id?: string | null
          weight_max?: number | null
          weight_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tatami_id_fkey"
            columns: ["tatami_id"]
            isOneToOne: false
            referencedRelation: "tatamis"
            referencedColumns: ["id"]
          },
        ]
      }
      club_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          club_contact: string | null
          club_name: string
          event_id: string
          id: string
          rejection_reason: string | null
          submitted_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          club_contact?: string | null
          club_name: string
          event_id: string
          id?: string
          rejection_reason?: string | null
          submitted_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          club_contact?: string | null
          club_name?: string
          event_id?: string
          id?: string
          rejection_reason?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_covers: {
        Row: {
          event_id: string
          image: string
          thumb: string | null
          updated_at: string
        }
        Insert: {
          event_id: string
          image: string
          thumb?: string | null
          updated_at?: string
        }
        Update: {
          event_id?: string
          image?: string
          thumb?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_covers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          id: string
          role: string
          tatami_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          role: string
          tatami_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          role?: string
          tatami_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_tatami_fk"
            columns: ["tatami_id"]
            isOneToOne: false
            referencedRelation: "tatamis"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          completed_at: string | null
          created_at: string
          end_date: string | null
          host_club: string | null
          id: string
          kata_minutes: number
          kumite_minutes: number
          name: string
          organizer_id: string
          purge_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          schedule_token: string | null
          start_date: string | null
          status: string
          team_minutes: number
          venue: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          end_date?: string | null
          host_club?: string | null
          id?: string
          kata_minutes?: number
          kumite_minutes?: number
          name: string
          organizer_id: string
          purge_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          schedule_token?: string | null
          start_date?: string | null
          status?: string
          team_minutes?: number
          venue?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          end_date?: string | null
          host_club?: string | null
          id?: string
          kata_minutes?: number
          kumite_minutes?: number
          name?: string
          organizer_id?: string
          purge_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          schedule_token?: string | null
          start_date?: string | null
          status?: string
          team_minutes?: number
          venue?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          a_source_id: string | null
          a_source_kind: string | null
          a_source_round: number | null
          athlete_a_id: string | null
          athlete_b_id: string | null
          b_source_id: string | null
          b_source_kind: string | null
          b_source_round: number | null
          bracket_id: string
          bracket_side: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_repechage: boolean
          pool: number | null
          position: number | null
          queue_order: number | null
          result_method: string | null
          result_note: string | null
          round: number
          scheduled_time: string | null
          scoring_device_id: string | null
          started_at: string | null
          status: string
          tatami_id: string | null
          winner_id: string | null
        }
        Insert: {
          a_source_id?: string | null
          a_source_kind?: string | null
          a_source_round?: number | null
          athlete_a_id?: string | null
          athlete_b_id?: string | null
          b_source_id?: string | null
          b_source_kind?: string | null
          b_source_round?: number | null
          bracket_id: string
          bracket_side?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_repechage?: boolean
          pool?: number | null
          position?: number | null
          queue_order?: number | null
          result_method?: string | null
          result_note?: string | null
          round: number
          scheduled_time?: string | null
          scoring_device_id?: string | null
          started_at?: string | null
          status?: string
          tatami_id?: string | null
          winner_id?: string | null
        }
        Update: {
          a_source_id?: string | null
          a_source_kind?: string | null
          a_source_round?: number | null
          athlete_a_id?: string | null
          athlete_b_id?: string | null
          b_source_id?: string | null
          b_source_kind?: string | null
          b_source_round?: number | null
          bracket_id?: string
          bracket_side?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_repechage?: boolean
          pool?: number | null
          position?: number | null
          queue_order?: number | null
          result_method?: string | null
          result_note?: string | null
          round?: number
          scheduled_time?: string | null
          scoring_device_id?: string | null
          started_at?: string | null
          status?: string
          tatami_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_a_source_id_fkey"
            columns: ["a_source_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_athlete_a_id_fkey"
            columns: ["athlete_a_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_athlete_b_id_fkey"
            columns: ["athlete_b_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_b_source_id_fkey"
            columns: ["b_source_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_bracket_id_fkey"
            columns: ["bracket_id"]
            isOneToOne: false
            referencedRelation: "brackets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tatami_id_fkey"
            columns: ["tatami_id"]
            isOneToOne: false
            referencedRelation: "tatamis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registration_links: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          regenerated_count: number
          token: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          regenerated_count?: number
          token: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          regenerated_count?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          athlete_id: string
          category_id: string
          created_at: string
          id: string
          overridden_by_organizer: boolean
          override_reason: string | null
          seed: number | null
          submitted_by: string
          weigh_in_status: string | null
        }
        Insert: {
          athlete_id: string
          category_id: string
          created_at?: string
          id?: string
          overridden_by_organizer?: boolean
          override_reason?: string | null
          seed?: number | null
          submitted_by?: string
          weigh_in_status?: string | null
        }
        Update: {
          athlete_id?: string
          category_id?: string
          created_at?: string
          id?: string
          overridden_by_organizer?: boolean
          override_reason?: string | null
          seed?: number | null
          submitted_by?: string
          weigh_in_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          actor_id: string | null
          athlete_id: string | null
          client_timestamp: string
          created_at: string
          detail: Json | null
          device_id: string
          id: string
          match_id: string
          server_sequence: number
          type: string
          value: number | null
          voids: string | null
        }
        Insert: {
          actor_id?: string | null
          athlete_id?: string | null
          client_timestamp: string
          created_at?: string
          detail?: Json | null
          device_id: string
          id?: string
          match_id: string
          server_sequence?: number
          type: string
          value?: number | null
          voids?: string | null
        }
        Update: {
          actor_id?: string | null
          athlete_id?: string | null
          client_timestamp?: string
          created_at?: string
          detail?: Json | null
          device_id?: string
          id?: string
          match_id?: string
          server_sequence?: number
          type?: string
          value?: number | null
          voids?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_voids_fkey"
            columns: ["voids"]
            isOneToOne: false
            referencedRelation: "score_events"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_conflicts: {
        Row: {
          actor_id: string | null
          created_at: string
          device_id: string
          event_id: string
          id: string
          match_id: string | null
          op: Json
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          device_id: string
          event_id: string
          id?: string
          match_id?: string | null
          op: Json
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          device_id?: string
          event_id?: string
          id?: string
          match_id?: string | null
          op?: Json
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_conflicts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tatamis: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tatamis_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_event_member: {
        Args: {
          p_email: string
          p_event_id: string
          p_role: string
          p_tatami_id?: string
        }
        Returns: undefined
      }
      approve_club_entry: { Args: { p_club_entry_id: string }; Returns: number }
      assert_event_writable: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      assert_schedule_editor: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      assign_category_to_tatami: {
        Args: { p_category_id: string; p_tatami_id?: string }
        Returns: undefined
      }
      belt_rank: { Args: { p_belt: string }; Returns: number }
      bracket_complete_match: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      bracket_event_id: { Args: { p_bracket_id: string }; Returns: string }
      bracket_propagate: { Args: { p_match_id: string }; Returns: undefined }
      bracket_resequence: { Args: { p_tatami_id: string }; Returns: undefined }
      bracket_seed_order: { Args: { p_size: number }; Returns: number[] }
      bracket_slot_value: {
        Args: { p_kind: string; p_round: number; p_source: string }
        Returns: string
      }
      bracket_snake_pool: {
        Args: { p_pools: number; p_seed: number }
        Returns: number
      }
      can_score_match: { Args: { p_match_id: string }; Returns: boolean }
      category_event_id: { Args: { p_category_id: string }; Returns: string }
      club_entry_event_id: {
        Args: { p_club_entry_id: string }
        Returns: string
      }
      complete_event: { Args: { p_event_id: string }; Returns: undefined }
      event_schedule: {
        Args: { p_event_id: string }
        Returns: {
          athlete_a: string
          athlete_b: string
          bracket_side: string
          category_label: string
          conflict: boolean
          discipline: string
          estimated_call_time: string
          match_id: string
          match_status: string
          minutes: number
          queue_position: number
          round: number
          tatami_id: string
          tatami_name: string
          tatami_status: string
        }[]
      }
      flag_club_entry: {
        Args: { p_club_entry_id: string; p_reason: string }
        Returns: undefined
      }
      generate_bracket: {
        Args: { p_category_id: string; p_format?: string }
        Returns: string
      }
      is_event_member: {
        Args: { p_event_id: string; p_roles?: string[] }
        Returns: boolean
      }
      is_organizer_account: { Args: never; Returns: boolean }
      list_event_staff: {
        Args: { p_event_id: string }
        Returns: {
          email: string
          id: string
          role: string
          tatami_id: string
        }[]
      }
      match_audit: { Args: { p_match_id: string }; Returns: Json }
      merge_categories: {
        Args: { p_sources: string[]; p_target: string }
        Returns: undefined
      }
      move_category_sequence: {
        Args: { p_category_id: string; p_direction: number }
        Returns: undefined
      }
      move_in_queue: {
        Args: { p_direction: number; p_match_id: string }
        Returns: undefined
      }
      organizer_add_athlete: {
        Args: {
          p_belt_rank: string
          p_club_entry_id: string
          p_date_of_birth: string
          p_full_name: string
          p_gender: string
          p_reason: string
          p_weight: number
        }
        Returns: string
      }
      organizer_edit_athlete: {
        Args: {
          p_athlete_id: string
          p_belt_rank: string
          p_date_of_birth: string
          p_full_name: string
          p_gender: string
          p_reason: string
          p_weight: number
        }
        Returns: undefined
      }
      override_match_result: {
        Args: { p_match_id: string; p_note: string; p_winner_id: string }
        Returns: undefined
      }
      pool_standings: {
        Args: { p_bracket_id: string }
        Returns: {
          athlete_id: string
          losses: number
          points_against: number
          points_for: number
          pool: number
          rank: number
          wins: number
        }[]
      }
      regenerate_registration_link: {
        Args: { p_event_id: string }
        Returns: string
      }
      regenerate_schedule_link: {
        Args: { p_event_id: string }
        Returns: string
      }
      release_match_claim: {
        Args: { p_match_id: string; p_note: string }
        Returns: undefined
      }
      resolve_scoring_conflict: {
        Args: { p_conflict_id: string; p_note: string }
        Returns: undefined
      }
      save_club_entry: {
        Args: {
          p_athletes: Json
          p_club_contact: string
          p_club_name: string
          p_event_id: string
          p_reference: string
        }
        Returns: string
      }
      scoring_apply_op: {
        Args: { p_device: string; p_op: Json }
        Returns: string
      }
      scoring_conflict: { Args: { p_reason: string }; Returns: undefined }
      scoring_effective_mode: {
        Args: { p_category: Database["public"]["Tables"]["categories"]["Row"] }
        Returns: string
      }
      scoring_finalize: {
        Args: {
          p_at: string
          p_match_id: string
          p_method: string
          p_note: string
          p_winner: string
        }
        Returns: undefined
      }
      set_seeds: {
        Args: { p_category_id: string; p_registration_ids: string[] }
        Returns: undefined
      }
      split_bracket_across_tatamis: {
        Args: {
          p_category_id: string
          p_converge_round?: number
          p_home_tatami: string
          p_tatami_ids: string[]
        }
        Returns: undefined
      }
      split_category: {
        Args: {
          p_category: string
          p_label: string
          p_registration_ids: string[]
        }
        Returns: string
      }
      suggest_categories: {
        Args: {
          p_belt: string
          p_date_of_birth: string
          p_event_id: string
          p_gender: string
          p_weight: number
        }
        Returns: {
          discipline: string
          id: string
          label: string
        }[]
      }
      sync_scoring: {
        Args: { p_device_id: string; p_ops: Json }
        Returns: Json
      }
      tatami_scoreboard: {
        Args: { p_tatami_id: string }
        Returns: {
          athlete_a: string
          athlete_a_id: string
          athlete_b: string
          athlete_b_id: string
          bracket_side: string
          category_id: string
          category_label: string
          discipline: string
          judge_panel: number
          match_id: string
          match_seconds: number
          match_status: string
          queue_position: number
          round: number
          scoring_device_id: string
          scoring_mode: string
          tatami_name: string
          tatami_status: string
        }[]
      }
      withdraw_athlete: {
        Args: { p_athlete_id: string; p_bracket_id: string; p_note: string }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const

