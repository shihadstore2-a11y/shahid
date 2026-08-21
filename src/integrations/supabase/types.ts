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
      ab_test_events: {
        Row: {
          created_at: string
          event_type: string
          experiment: string
          id: string
          session_id: string
          user_agent: string | null
          variant: string
        }
        Insert: {
          created_at?: string
          event_type: string
          experiment: string
          id?: string
          session_id: string
          user_agent?: string | null
          variant: string
        }
        Update: {
          created_at?: string
          event_type?: string
          experiment?: string
          id?: string
          session_id?: string
          user_agent?: string | null
          variant?: string
        }
        Relationships: []
      }
      activation_email_log: {
        Row: {
          clicked_at: string | null
          day_marker: number
          id: string
          metadata: Json
          opened_at: string | null
          recipient_email: string
          sent_at: string
          skip_reason: string | null
          skipped: boolean
          template_name: string
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          day_marker: number
          id?: string
          metadata?: Json
          opened_at?: string | null
          recipient_email: string
          sent_at?: string
          skip_reason?: string | null
          skipped?: boolean
          template_name: string
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          day_marker?: number
          id?: string
          metadata?: Json
          opened_at?: string | null
          recipient_email?: string
          sent_at?: string
          skip_reason?: string | null
          skipped?: boolean
          template_name?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          admin_user_id: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      annual_upgrade_offers: {
        Row: {
          clicked_at: string | null
          discount_pct: number
          id: string
          metadata: Json
          shown_at: string
          upgraded_at: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          discount_pct?: number
          id?: string
          metadata?: Json
          shown_at?: string
          upgraded_at?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          discount_pct?: number
          id?: string
          metadata?: Json
          shown_at?: string
          upgraded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          founding_base_count: number
          founding_discount_pct: number
          founding_program_active: boolean
          founding_total_seats: number
          id: number
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          founding_base_count?: number
          founding_discount_pct?: number
          founding_program_active?: boolean
          founding_total_seats?: number
          id?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          founding_base_count?: number
          founding_discount_pct?: number
          founding_program_active?: boolean
          founding_total_seats?: number
          id?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      backup_plan_entitlements_20260502: {
        Row: {
          active: boolean | null
          daily_image_cap: number | null
          daily_text_cap: number | null
          image_pro_allowed: boolean | null
          max_video_duration_seconds: number | null
          monthly_credits: number | null
          monthly_price_sar: number | null
          plan: Database["public"]["Enums"]["user_plan"] | null
          updated_at: string | null
          video_fast_allowed: boolean | null
          video_quality_allowed: boolean | null
          yearly_price_sar: number | null
        }
        Insert: {
          active?: boolean | null
          daily_image_cap?: number | null
          daily_text_cap?: number | null
          image_pro_allowed?: boolean | null
          max_video_duration_seconds?: number | null
          monthly_credits?: number | null
          monthly_price_sar?: number | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          updated_at?: string | null
          video_fast_allowed?: boolean | null
          video_quality_allowed?: boolean | null
          yearly_price_sar?: number | null
        }
        Update: {
          active?: boolean | null
          daily_image_cap?: number | null
          daily_text_cap?: number | null
          image_pro_allowed?: boolean | null
          max_video_duration_seconds?: number | null
          monthly_credits?: number | null
          monthly_price_sar?: number | null
          plan?: Database["public"]["Enums"]["user_plan"] | null
          updated_at?: string | null
          video_fast_allowed?: boolean | null
          video_quality_allowed?: boolean | null
          yearly_price_sar?: number | null
        }
        Relationships: []
      }
      backup_user_credits_20260502: {
        Row: {
          cycle_ends_at: string | null
          cycle_started_at: string | null
          plan_credits: number | null
          topup_credits: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cycle_ends_at?: string | null
          cycle_started_at?: string | null
          plan_credits?: number | null
          topup_credits?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cycle_ends_at?: string | null
          cycle_started_at?: string | null
          plan_credits?: number | null
          topup_credits?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_video_jobs_20260502: {
        Row: {
          aspect_ratio: string | null
          completed_at: string | null
          created_at: string | null
          credits_charged: number | null
          duration_seconds: number | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string | null
          ledger_id: string | null
          metadata: Json | null
          product_image_url: string | null
          prompt: string | null
          provider: string | null
          provider_job_id: string | null
          quality: Database["public"]["Enums"]["video_quality"] | null
          refund_ledger_id: string | null
          result_url: string | null
          selected_persona_id: string | null
          speaker_image_url: string | null
          starting_frame_url: string | null
          status: Database["public"]["Enums"]["video_job_status"] | null
          storage_path: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string | null
          ledger_id?: string | null
          metadata?: Json | null
          product_image_url?: string | null
          prompt?: string | null
          provider?: string | null
          provider_job_id?: string | null
          quality?: Database["public"]["Enums"]["video_quality"] | null
          refund_ledger_id?: string | null
          result_url?: string | null
          selected_persona_id?: string | null
          speaker_image_url?: string | null
          starting_frame_url?: string | null
          status?: Database["public"]["Enums"]["video_job_status"] | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_charged?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string | null
          ledger_id?: string | null
          metadata?: Json | null
          product_image_url?: string | null
          prompt?: string | null
          provider?: string | null
          provider_job_id?: string | null
          quality?: Database["public"]["Enums"]["video_quality"] | null
          refund_ledger_id?: string | null
          result_url?: string | null
          selected_persona_id?: string | null
          speaker_image_url?: string | null
          starting_frame_url?: string | null
          status?: Database["public"]["Enums"]["video_job_status"] | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_video_provider_configs_20260502: {
        Row: {
          cost_5s: number | null
          cost_8s: number | null
          created_at: string | null
          display_name_admin: string | null
          enabled: boolean | null
          health_status: string | null
          id: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          metadata: Json | null
          mode: string | null
          priority: number | null
          provider_key: string | null
          public_enabled: boolean | null
          supported_qualities: string[] | null
          supports_1_1: boolean | null
          supports_16_9: boolean | null
          supports_9_16: boolean | null
          supports_starting_frame: boolean | null
          updated_at: string | null
        }
        Insert: {
          cost_5s?: number | null
          cost_8s?: number | null
          created_at?: string | null
          display_name_admin?: string | null
          enabled?: boolean | null
          health_status?: string | null
          id?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json | null
          mode?: string | null
          priority?: number | null
          provider_key?: string | null
          public_enabled?: boolean | null
          supported_qualities?: string[] | null
          supports_1_1?: boolean | null
          supports_16_9?: boolean | null
          supports_9_16?: boolean | null
          supports_starting_frame?: boolean | null
          updated_at?: string | null
        }
        Update: {
          cost_5s?: number | null
          cost_8s?: number | null
          created_at?: string | null
          display_name_admin?: string | null
          enabled?: boolean | null
          health_status?: string | null
          id?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json | null
          mode?: string | null
          priority?: number | null
          provider_key?: string | null
          public_enabled?: boolean | null
          supported_qualities?: string[] | null
          supports_1_1?: boolean | null
          supports_16_9?: boolean | null
          supports_9_16?: boolean | null
          supports_starting_frame?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_packs: {
        Row: {
          ab_variants: Json
          audience: string
          brief: string
          channel: string
          created_at: string
          goal: string
          id: string
          image_prompt: string
          offer: string
          product: string
          product_image_path: string | null
          publishing_calendar: Json
          status: string
          text_prompt: string
          updated_at: string
          user_id: string
          video_prompt: string
        }
        Insert: {
          ab_variants?: Json
          audience?: string
          brief?: string
          channel?: string
          created_at?: string
          goal?: string
          id?: string
          image_prompt?: string
          offer?: string
          product?: string
          product_image_path?: string | null
          publishing_calendar?: Json
          status?: string
          text_prompt?: string
          updated_at?: string
          user_id: string
          video_prompt?: string
        }
        Update: {
          ab_variants?: Json
          audience?: string
          brief?: string
          channel?: string
          created_at?: string
          goal?: string
          id?: string
          image_prompt?: string
          offer?: string
          product?: string
          product_image_path?: string | null
          publishing_calendar?: Json
          status?: string
          text_prompt?: string
          updated_at?: string
          user_id?: string
          video_prompt?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          consent_given: boolean
          consent_text: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          consent_version: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          source: Database["public"]["Enums"]["consent_source"]
          user_agent: string | null
          user_id: string
          withdrawn_at: string | null
          withdrawn_reason: string | null
        }
        Insert: {
          consent_given: boolean
          consent_text: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          source: Database["public"]["Enums"]["consent_source"]
          user_agent?: string | null
          user_id: string
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_text?: string
          consent_type?: Database["public"]["Enums"]["consent_type"]
          consent_version?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          source?: Database["public"]["Enums"]["consent_source"]
          user_agent?: string | null
          user_id?: string
          withdrawn_at?: string | null
          withdrawn_reason?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string
          name: string
          phone: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          phone?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          phone?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after_plan: number
          balance_after_topup: number
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          refund_ledger_id: string | null
          refunded_at: string | null
          source: Database["public"]["Enums"]["credit_source"] | null
          txn_type: Database["public"]["Enums"]["credit_txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after_plan: number
          balance_after_topup: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          refund_ledger_id?: string | null
          refunded_at?: string | null
          source?: Database["public"]["Enums"]["credit_source"] | null
          txn_type: Database["public"]["Enums"]["credit_txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after_plan?: number
          balance_after_topup?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          refund_ledger_id?: string | null
          refunded_at?: string | null
          source?: Database["public"]["Enums"]["credit_source"] | null
          txn_type?: Database["public"]["Enums"]["credit_txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_refund_ledger_id_fkey"
            columns: ["refund_ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_text_usage: {
        Row: {
          day: string
          image_count: number
          text_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          day: string
          image_count?: number
          text_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          day?: string
          image_count?: number
          text_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_rate_limits: {
        Row: {
          count: number
          hour_bucket: string
          ip: string
          updated_at: string
        }
        Insert: {
          count?: number
          hour_bucket: string
          ip: string
          updated_at?: string
        }
        Update: {
          count?: number
          hour_bucket?: string
          ip?: string
          updated_at?: string
        }
        Relationships: []
      }
      dlq_alert_state: {
        Row: {
          id: number
          last_alert_at: string | null
          last_alert_count: number | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_alert_at?: string | null
          last_alert_count?: number | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_alert_at?: string | null
          last_alert_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      domain_scan_log: {
        Row: {
          details: Json
          error_message: string | null
          id: string
          scan_type: string
          scanned_at: string
          status: string
          total_matches: number
        }
        Insert: {
          details?: Json
          error_message?: string | null
          id?: string
          scan_type: string
          scanned_at?: string
          status: string
          total_matches?: number
        }
        Update: {
          details?: Json
          error_message?: string | null
          id?: string
          scan_type?: string
          scanned_at?: string
          status?: string
          total_matches?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      generations: {
        Row: {
          completion_tokens: number | null
          created_at: string
          estimated_cost_usd: number | null
          id: string
          is_favorite: boolean
          metadata: Json | null
          model_used: string | null
          prompt: string
          prompt_tokens: number | null
          result: string | null
          template: string | null
          total_tokens: number | null
          type: Database["public"]["Enums"]["generation_type"]
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          is_favorite?: boolean
          metadata?: Json | null
          model_used?: string | null
          prompt: string
          prompt_tokens?: number | null
          result?: string | null
          template?: string | null
          total_tokens?: number | null
          type: Database["public"]["Enums"]["generation_type"]
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          is_favorite?: boolean
          metadata?: Json | null
          model_used?: string | null
          prompt?: string
          prompt_tokens?: number | null
          result?: string | null
          template?: string | null
          total_tokens?: number | null
          type?: Database["public"]["Enums"]["generation_type"]
          user_id?: string
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      launch_bonus_recipients: {
        Row: {
          credits_granted: number
          granted_at: string
          id: string
          ledger_id: string | null
          recipient_number: number
          subscription_request_id: string | null
          user_id: string
        }
        Insert: {
          credits_granted?: number
          granted_at?: string
          id?: string
          ledger_id?: string | null
          recipient_number: number
          subscription_request_id?: string | null
          user_id: string
        }
        Update: {
          credits_granted?: number
          granted_at?: string
          id?: string
          ledger_id?: string | null
          recipient_number?: number
          subscription_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_bonus_recipients_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_bonus_recipients_subscription_request_id_fkey"
            columns: ["subscription_request_id"]
            isOneToOne: false
            referencedRelation: "subscription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_usage: {
        Row: {
          created_at: string
          cycle_end: string
          cycle_start: string
          image_used: number
          text_used: number
          updated_at: string
          user_id: string
          video_used: number
        }
        Insert: {
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          image_used?: number
          text_used?: number
          updated_at?: string
          user_id: string
          video_used?: number
        }
        Update: {
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          image_used?: number
          text_used?: number
          updated_at?: string
          user_id?: string
          video_used?: number
        }
        Relationships: []
      }
      onboarding_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          step: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          step: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          step?: number
          user_id?: string
        }
        Relationships: []
      }
      operational_switches: {
        Row: {
          enabled: boolean
          key: string
          reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          bank_account_holder: string | null
          bank_iban: string | null
          bank_name: string | null
          id: number
          updated_at: string
        }
        Insert: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      plan_credits: {
        Row: {
          daily_image_cap: number
          daily_text_cap: number
          monthly_credits: number
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
        }
        Insert: {
          daily_image_cap?: number
          daily_text_cap?: number
          monthly_credits: number
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Update: {
          daily_image_cap?: number
          daily_text_cap?: number
          monthly_credits?: number
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          active: boolean
          daily_image_cap: number
          daily_text_cap: number
          image_pro_allowed: boolean
          max_video_duration_seconds: number
          monthly_credits: number
          monthly_image_cap: number | null
          monthly_price_sar: number
          monthly_text_cap: number | null
          monthly_video_count_cap: number | null
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
          video_fast_allowed: boolean
          video_quality_allowed: boolean
          yearly_price_sar: number
        }
        Insert: {
          active?: boolean
          daily_image_cap?: number
          daily_text_cap?: number
          image_pro_allowed?: boolean
          max_video_duration_seconds?: number
          monthly_credits?: number
          monthly_image_cap?: number | null
          monthly_price_sar?: number
          monthly_text_cap?: number | null
          monthly_video_count_cap?: number | null
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
          video_fast_allowed?: boolean
          video_quality_allowed?: boolean
          yearly_price_sar?: number
        }
        Update: {
          active?: boolean
          daily_image_cap?: number
          daily_text_cap?: number
          image_pro_allowed?: boolean
          max_video_duration_seconds?: number
          monthly_credits?: number
          monthly_image_cap?: number | null
          monthly_price_sar?: number
          monthly_text_cap?: number | null
          monthly_video_count_cap?: number | null
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
          video_fast_allowed?: boolean
          video_quality_allowed?: boolean
          yearly_price_sar?: number
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          kind: string
          monthly_limit: number
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
        }
        Insert: {
          kind: string
          monthly_limit: number
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Update: {
          kind?: string
          monthly_limit?: number
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      pricing_experiments: {
        Row: {
          billing_cycle: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["pricing_event_type"]
          id: string
          metadata: Json | null
          plan_id: string | null
          session_id: string | null
          user_id: string | null
          variant: string | null
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["pricing_event_type"]
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          session_id?: string | null
          user_id?: string | null
          variant?: string | null
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["pricing_event_type"]
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          session_id?: string | null
          user_id?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          audience: string | null
          banned_phrases: string[]
          brand_color: string | null
          brand_personality: string | null
          compliance_notes: string | null
          consent_last_updated_at: string | null
          created_at: string
          cta_style: string | null
          email: string | null
          exchange_policy: string | null
          faq_notes: string | null
          full_name: string | null
          high_margin_products: string[]
          id: string
          is_founding_member: boolean
          marketing_email_opt_in: boolean
          marketing_telegram_opt_in: boolean
          marketing_whatsapp_opt_in: boolean
          onboarded: boolean
          onboarding_completed_at: string | null
          onboarding_step: number
          plan: Database["public"]["Enums"]["user_plan"]
          product_type: string | null
          product_updates_opt_in: boolean
          seasonal_priorities: string[]
          shipping_policy: string | null
          store_name: string | null
          tone: string | null
          unique_selling_point: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          audience?: string | null
          banned_phrases?: string[]
          brand_color?: string | null
          brand_personality?: string | null
          compliance_notes?: string | null
          consent_last_updated_at?: string | null
          created_at?: string
          cta_style?: string | null
          email?: string | null
          exchange_policy?: string | null
          faq_notes?: string | null
          full_name?: string | null
          high_margin_products?: string[]
          id: string
          is_founding_member?: boolean
          marketing_email_opt_in?: boolean
          marketing_telegram_opt_in?: boolean
          marketing_whatsapp_opt_in?: boolean
          onboarded?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: Database["public"]["Enums"]["user_plan"]
          product_type?: string | null
          product_updates_opt_in?: boolean
          seasonal_priorities?: string[]
          shipping_policy?: string | null
          store_name?: string | null
          tone?: string | null
          unique_selling_point?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          audience?: string | null
          banned_phrases?: string[]
          brand_color?: string | null
          brand_personality?: string | null
          compliance_notes?: string | null
          consent_last_updated_at?: string | null
          created_at?: string
          cta_style?: string | null
          email?: string | null
          exchange_policy?: string | null
          faq_notes?: string | null
          full_name?: string | null
          high_margin_products?: string[]
          id?: string
          is_founding_member?: boolean
          marketing_email_opt_in?: boolean
          marketing_telegram_opt_in?: boolean
          marketing_whatsapp_opt_in?: boolean
          onboarded?: boolean
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: Database["public"]["Enums"]["user_plan"]
          product_type?: string | null
          product_updates_opt_in?: boolean
          seasonal_priorities?: string[]
          shipping_policy?: string | null
          store_name?: string | null
          tone?: string | null
          unique_selling_point?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      provider_health_window: {
        Row: {
          created_at: string
          fail_count: number
          fail_rate: number | null
          id: string
          provider_key: string
          success_count: number
          total_count: number | null
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          fail_count?: number
          fail_rate?: number | null
          id?: string
          provider_key: string
          success_count?: number
          total_count?: number | null
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          fail_count?: number
          fail_rate?: number | null
          id?: string
          provider_key?: string
          success_count?: number
          total_count?: number | null
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      provider_kill_switch_events: {
        Row: {
          created_at: string
          fail_count: number
          fail_rate: number
          id: string
          metadata: Json | null
          provider_key: string
          restore_reason: string | null
          restored_at: string | null
          restored_by: string | null
          success_count: number
          triggered_at: string
          window_minutes: number
        }
        Insert: {
          created_at?: string
          fail_count: number
          fail_rate: number
          id?: string
          metadata?: Json | null
          provider_key: string
          restore_reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          success_count: number
          triggered_at?: string
          window_minutes?: number
        }
        Update: {
          created_at?: string
          fail_count?: number
          fail_rate?: number
          id?: string
          metadata?: Json | null
          provider_key?: string
          restore_reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          success_count?: number
          triggered_at?: string
          window_minutes?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code_used: string
          created_at: string
          id: string
          qualified_at: string | null
          referred_user_id: string
          referrer_user_id: string
          reward_points: number
          rewarded_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          code_used: string
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_user_id: string
          referrer_user_id: string
          reward_points?: number
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          code_used?: string
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          reward_points?: number
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: []
      }
      stale_subs_alert_state: {
        Row: {
          id: number
          last_alert_at: string | null
          last_alert_count: number | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_alert_at?: string | null
          last_alert_count?: number | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_alert_at?: string | null
          last_alert_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          activated_at: string | null
          activated_until: string | null
          admin_notes: string | null
          billing_cycle: string
          created_at: string
          email: string
          id: string
          notes: string | null
          ocr_error: string | null
          ocr_processed_at: string | null
          ocr_receipt_path: string | null
          ocr_status: string | null
          payment_method: string | null
          plan: Database["public"]["Enums"]["user_plan"]
          receipt_path: string | null
          receipt_uploaded_at: string | null
          status: Database["public"]["Enums"]["subscription_request_status"]
          store_name: string | null
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          activated_at?: string | null
          activated_until?: string | null
          admin_notes?: string | null
          billing_cycle?: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          ocr_error?: string | null
          ocr_processed_at?: string | null
          ocr_receipt_path?: string | null
          ocr_status?: string | null
          payment_method?: string | null
          plan: Database["public"]["Enums"]["user_plan"]
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["subscription_request_status"]
          store_name?: string | null
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          activated_at?: string | null
          activated_until?: string | null
          admin_notes?: string | null
          billing_cycle?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          ocr_error?: string | null
          ocr_processed_at?: string | null
          ocr_receipt_path?: string | null
          ocr_status?: string | null
          payment_method?: string | null
          plan?: Database["public"]["Enums"]["user_plan"]
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["subscription_request_status"]
          store_name?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      topup_packages: {
        Row: {
          created_at: string
          credits: number
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          price_sar: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          display_name: string
          display_order?: number
          id: string
          is_active?: boolean
          price_sar: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean
          price_sar?: number
          updated_at?: string
        }
        Relationships: []
      }
      topup_purchases: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          admin_notes: string | null
          created_at: string
          credits: number
          id: string
          idempotency_key: string
          ledger_id: string | null
          metadata: Json | null
          package_id: string
          payment_method: string | null
          price_sar: number
          receipt_path: string | null
          receipt_uploaded_at: string | null
          status: Database["public"]["Enums"]["topup_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          admin_notes?: string | null
          created_at?: string
          credits: number
          id?: string
          idempotency_key: string
          ledger_id?: string | null
          metadata?: Json | null
          package_id: string
          payment_method?: string | null
          price_sar: number
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          admin_notes?: string | null
          created_at?: string
          credits?: number
          id?: string
          idempotency_key?: string
          ledger_id?: string | null
          metadata?: Json | null
          package_id?: string
          payment_method?: string | null
          price_sar?: number
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topup_purchases_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topup_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "topup_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          id: string
          image_count: number
          month: string
          text_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          image_count?: number
          month: string
          text_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          image_count?: number
          month?: string
          text_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_type: Database["public"]["Enums"]["badge_type"]
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_type: Database["public"]["Enums"]["badge_type"]
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_type?: Database["public"]["Enums"]["badge_type"]
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          cycle_ends_at: string | null
          cycle_started_at: string
          plan_credits: number
          topup_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cycle_ends_at?: string | null
          cycle_started_at?: string
          plan_credits?: number
          topup_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cycle_ends_at?: string | null
          cycle_started_at?: string
          plan_credits?: number
          topup_credits?: number
          updated_at?: string
          user_id?: string
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
      video_jobs: {
        Row: {
          aspect_ratio: string
          completed_at: string | null
          created_at: string
          credits_charged: number
          duration_seconds: number
          error_category:
            | Database["public"]["Enums"]["video_error_category"]
            | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          ledger_id: string | null
          metadata: Json | null
          product_image_url: string | null
          prompt: string
          provider: string
          provider_job_id: string | null
          quality: Database["public"]["Enums"]["video_quality"]
          refund_ledger_id: string | null
          result_url: string | null
          selected_persona_id: string | null
          speaker_image_url: string | null
          starting_frame_url: string | null
          status: Database["public"]["Enums"]["video_job_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          completed_at?: string | null
          created_at?: string
          credits_charged: number
          duration_seconds?: number
          error_category?:
            | Database["public"]["Enums"]["video_error_category"]
            | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          ledger_id?: string | null
          metadata?: Json | null
          product_image_url?: string | null
          prompt: string
          provider?: string
          provider_job_id?: string | null
          quality: Database["public"]["Enums"]["video_quality"]
          refund_ledger_id?: string | null
          result_url?: string | null
          selected_persona_id?: string | null
          speaker_image_url?: string | null
          starting_frame_url?: string | null
          status?: Database["public"]["Enums"]["video_job_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          completed_at?: string | null
          created_at?: string
          credits_charged?: number
          duration_seconds?: number
          error_category?:
            | Database["public"]["Enums"]["video_error_category"]
            | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          ledger_id?: string | null
          metadata?: Json | null
          product_image_url?: string | null
          prompt?: string
          provider?: string
          provider_job_id?: string | null
          quality?: Database["public"]["Enums"]["video_quality"]
          refund_ledger_id?: string | null
          result_url?: string | null
          selected_persona_id?: string | null
          speaker_image_url?: string | null
          starting_frame_url?: string | null
          status?: Database["public"]["Enums"]["video_job_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_jobs_refund_ledger_id_fkey"
            columns: ["refund_ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      video_provider_configs: {
        Row: {
          cost_5s: number
          cost_8s: number
          created_at: string
          display_name_admin: string
          enabled: boolean
          health_status: string
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          metadata: Json
          mode: string
          priority: number
          provider_key: string
          public_enabled: boolean
          supported_qualities: string[]
          supports_1_1: boolean
          supports_16_9: boolean
          supports_9_16: boolean
          supports_starting_frame: boolean
          updated_at: string
        }
        Insert: {
          cost_5s?: number
          cost_8s?: number
          created_at?: string
          display_name_admin: string
          enabled?: boolean
          health_status?: string
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          mode?: string
          priority?: number
          provider_key: string
          public_enabled?: boolean
          supported_qualities?: string[]
          supports_1_1?: boolean
          supports_16_9?: boolean
          supports_9_16?: boolean
          supports_starting_frame?: boolean
          updated_at?: string
        }
        Update: {
          cost_5s?: number
          cost_8s?: number
          created_at?: string
          display_name_admin?: string
          enabled?: boolean
          health_status?: string
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          metadata?: Json
          mode?: string
          priority?: number
          provider_key?: string
          public_enabled?: boolean
          supported_qualities?: string[]
          supports_1_1?: boolean
          supports_16_9?: boolean
          supports_9_16?: boolean
          supports_starting_frame?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_consent_stats: {
        Row: {
          active_consents: number | null
          consent_type: Database["public"]["Enums"]["consent_type"] | null
          denied_consents: number | null
          first_consent_at: string | null
          last_consent_at: string | null
          total_users_decided: number | null
          withdrawn_consents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ensure_user_credits: { Args: { _uid: string }; Returns: undefined }
      activate_topup_purchase: {
        Args: { _purchase_id: string }
        Returns: {
          cycle_ends_at: string | null
          cycle_started_at: string
          plan_credits: number
          topup_credits: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_credits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_usage: {
        Args: { _kind: string; _month: string }
        Returns: {
          id: string
          image_count: number
          month: string
          text_count: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "usage_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_email_dlq_health: { Args: never; Returns: Json }
      check_free_monthly_video_quota: {
        Args: never
        Returns: {
          allowed: boolean
          monthly_cap: number
          next_reset_at: string
          used: number
        }[]
      }
      claim_referral_code: { Args: { _code: string }; Returns: Json }
      consume_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reference_id?: string
          _reference_type?: string
          _txn_type: Database["public"]["Enums"]["credit_txn_type"]
        }
        Returns: {
          ledger_id: string
          remaining_plan: number
          remaining_topup: number
          remaining_total: number
        }[]
      }
      consume_demo_token: {
        Args: { _ip: string; _limit: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      consume_image_quota: {
        Args: { _quality?: string }
        Returns: {
          allowed: boolean
          daily_cap: number
          used: number
        }[]
      }
      consume_text_quota: {
        Args: never
        Returns: {
          allowed: boolean
          daily_cap: number
          used: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fn_award_badge_if_new: {
        Args: {
          _badge: Database["public"]["Enums"]["badge_type"]
          _metadata?: Json
          _user_id: string
        }
        Returns: boolean
      }
      generate_referral_code: { Args: never; Returns: string }
      get_email_activation_funnel: { Args: { _days?: number }; Returns: Json }
      get_founding_status: {
        Args: never
        Returns: {
          current_subscribers: number
          discount_pct: number
          program_active: boolean
          seats_left: number
          seats_total: number
        }[]
      }
      get_launch_bonus_stats: {
        Args: never
        Returns: {
          cap: number
          remaining: number
          total_granted: number
        }[]
      }
      get_onboarding_funnel: {
        Args: { _days?: number }
        Returns: {
          active_store_badges: number
          autogen_failed: number
          autogen_succeeded: number
          step1_completed: number
          step2_completed: number
          step3_completed: number
          total_started: number
          wizard_completed: number
        }[]
      }
      get_or_create_current_monthly_cycle: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          cycle_end: string
          cycle_start: string
          image_used: number
          text_used: number
          updated_at: string
          user_id: string
          video_used: number
        }
        SetofOptions: {
          from: "*"
          to: "monthly_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pricing_funnel: {
        Args: { _days?: number }
        Returns: {
          annual_share_pct: number
          annual_toggles: number
          conversions: number
          cta_click_rate_pct: number
          cta_clicks: number
          plan_clicks: number
          top_plan: string
          total_views: number
        }[]
      }
      get_provider_health_summary: {
        Args: never
        Returns: {
          active_kill_switch: boolean
          enabled: boolean
          fail_24h: number
          fail_rate_24h: number
          health_status: string
          last_kill_switch_at: string
          priority: number
          provider_key: string
          success_24h: number
          total_24h: number
        }[]
      }
      get_public_app_settings: {
        Args: never
        Returns: {
          founding_base_count: number
          founding_discount_pct: number
          founding_program_active: boolean
          founding_total_seats: number
        }[]
      }
      get_referral_stats: { Args: { _days?: number }; Returns: Json }
      get_stale_subscription_requests: {
        Args: never
        Returns: {
          billing_cycle: string
          created_at: string
          email: string
          hours_old: number
          id: string
          plan: Database["public"]["Enums"]["user_plan"]
          status: Database["public"]["Enums"]["subscription_request_status"]
          store_name: string
          whatsapp: string
        }[]
      }
      get_subscribers_count: {
        Args: never
        Returns: {
          total: number
        }[]
      }
      get_user_badges: {
        Args: { _user_id?: string }
        Returns: {
          awarded_at: string
          badge_type: Database["public"]["Enums"]["badge_type"]
          metadata: Json
        }[]
      }
      get_user_consent_status: {
        Args: { _consent_type?: Database["public"]["Enums"]["consent_type"] }
        Returns: {
          consent_given: boolean
          consent_type: Database["public"]["Enums"]["consent_type"]
          consent_version: string
          last_updated: string
          source: Database["public"]["Enums"]["consent_source"]
        }[]
      }
      get_user_credits_summary: {
        Args: never
        Returns: {
          cycle_ends_at: string
          daily_image_cap: number
          daily_image_used: number
          daily_text_cap: number
          daily_text_used: number
          image_pro_allowed: boolean
          max_video_duration_seconds: number
          plan: Database["public"]["Enums"]["user_plan"]
          plan_credits: number
          topup_credits: number
          total_credits: number
          video_fast_allowed: boolean
          video_quality_allowed: boolean
        }[]
      }
      grant_compensation_credits: {
        Args: {
          _amount: number
          _reason: string
          _reference_id?: string
          _reference_type?: string
          _user_id: string
        }
        Returns: string
      }
      grant_launch_bonus_if_eligible: {
        Args: { _subscription_request_id?: string; _user_id: string }
        Returns: {
          granted: boolean
          reason: string
          recipient_number: number
        }[]
      }
      has_marketing_consent: {
        Args: {
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      operational_switch_enabled: { Args: { _key: string }; Returns: boolean }
      plan_entitlement_for_user: {
        Args: { _user_id?: string }
        Returns: {
          active: boolean
          daily_image_cap: number
          daily_text_cap: number
          image_pro_allowed: boolean
          max_video_duration_seconds: number
          monthly_credits: number
          monthly_image_cap: number | null
          monthly_price_sar: number
          monthly_text_cap: number | null
          monthly_video_count_cap: number | null
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
          video_fast_allowed: boolean
          video_quality_allowed: boolean
          yearly_price_sar: number
        }
        SetofOptions: {
          from: "*"
          to: "plan_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reconcile_usage_logs: {
        Args: { _month?: string }
        Returns: {
          image_diff: number
          month: string
          new_image_count: number
          new_text_count: number
          old_image_count: number
          old_text_count: number
          text_diff: number
          user_id: string
        }[]
      }
      record_consent: {
        Args: {
          _consent_given: boolean
          _consent_text: string
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _consent_version?: string
          _metadata?: Json
          _source?: Database["public"]["Enums"]["consent_source"]
          _user_agent?: string
        }
        Returns: string
      }
      record_free_monthly_video_usage: { Args: never; Returns: undefined }
      record_generation: {
        Args: {
          _completion_tokens?: number
          _estimated_cost_usd?: number
          _metadata?: Json
          _model_used?: string
          _prompt: string
          _prompt_tokens?: number
          _result: string
          _template?: string
          _total_tokens?: number
          _type: Database["public"]["Enums"]["generation_type"]
        }
        Returns: {
          completion_tokens: number | null
          created_at: string
          estimated_cost_usd: number | null
          id: string
          is_favorite: boolean
          metadata: Json | null
          model_used: string | null
          prompt: string
          prompt_tokens: number | null
          result: string | null
          template: string | null
          total_tokens: number | null
          type: Database["public"]["Enums"]["generation_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "generations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_credits: {
        Args: { _ledger_id: string; _reason?: string }
        Returns: string
      }
      release_image_daily_quota: {
        Args: { _user_id?: string }
        Returns: undefined
      }
      reset_monthly_credits: {
        Args: {
          _plan: Database["public"]["Enums"]["user_plan"]
          _user_id: string
        }
        Returns: {
          cycle_ends_at: string | null
          cycle_started_at: string
          plan_credits: number
          topup_credits: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_credits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_provider: {
        Args: { _provider_key: string; _reason?: string }
        Returns: {
          cost_5s: number
          cost_8s: number
          created_at: string
          display_name_admin: string
          enabled: boolean
          health_status: string
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          metadata: Json
          mode: string
          priority: number
          provider_key: string
          public_enabled: boolean
          supported_qualities: string[]
          supports_1_1: boolean
          supports_16_9: boolean
          supports_9_16: boolean
          supports_starting_frame: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "video_provider_configs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_consent: {
        Args: {
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _reason?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      badge_type: "first_text" | "first_image" | "first_video" | "active_store"
      consent_source:
        | "onboarding"
        | "settings"
        | "subscription_form"
        | "telegram_bot"
        | "whatsapp_form"
        | "admin_action"
        | "api"
      consent_type:
        | "marketing_email"
        | "marketing_whatsapp"
        | "marketing_telegram"
        | "marketing_sms"
        | "product_updates"
        | "newsletter"
      credit_source: "plan" | "topup"
      credit_txn_type:
        | "plan_grant"
        | "topup_purchase"
        | "consume_image"
        | "consume_video"
        | "refund"
        | "admin_adjust"
        | "expire"
      generation_type: "text" | "image" | "image_enhance"
      pricing_event_type:
        | "page_view"
        | "annual_toggled"
        | "plan_clicked"
        | "cta_clicked"
        | "converted"
      referral_status: "pending" | "qualified" | "rewarded"
      subscription_request_status:
        | "pending"
        | "contacted"
        | "activated"
        | "rejected"
        | "expired"
      topup_status: "pending" | "paid" | "activated" | "rejected" | "refunded"
      user_plan: "free" | "pro" | "business" | "starter" | "growth"
      video_error_category:
        | "provider_error"
        | "user_error"
        | "content_error"
        | "timeout"
        | "unknown"
      video_job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
      video_quality: "fast" | "quality" | "lite"
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
      app_role: ["admin", "moderator", "user"],
      badge_type: ["first_text", "first_image", "first_video", "active_store"],
      consent_source: [
        "onboarding",
        "settings",
        "subscription_form",
        "telegram_bot",
        "whatsapp_form",
        "admin_action",
        "api",
      ],
      consent_type: [
        "marketing_email",
        "marketing_whatsapp",
        "marketing_telegram",
        "marketing_sms",
        "product_updates",
        "newsletter",
      ],
      credit_source: ["plan", "topup"],
      credit_txn_type: [
        "plan_grant",
        "topup_purchase",
        "consume_image",
        "consume_video",
        "refund",
        "admin_adjust",
        "expire",
      ],
      generation_type: ["text", "image", "image_enhance"],
      pricing_event_type: [
        "page_view",
        "annual_toggled",
        "plan_clicked",
        "cta_clicked",
        "converted",
      ],
      referral_status: ["pending", "qualified", "rewarded"],
      subscription_request_status: [
        "pending",
        "contacted",
        "activated",
        "rejected",
        "expired",
      ],
      topup_status: ["pending", "paid", "activated", "rejected", "refunded"],
      user_plan: ["free", "pro", "business", "starter", "growth"],
      video_error_category: [
        "provider_error",
        "user_error",
        "content_error",
        "timeout",
        "unknown",
      ],
      video_job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      video_quality: ["fast", "quality", "lite"],
    },
  },
} as const
