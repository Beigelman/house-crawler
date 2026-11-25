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
      crawl_jobs: {
        Row: {
          created_at: string;
          email_state: string;
          error_category: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          request_key: string | null;
          requested_by: string | null;
          scheduled_at: string | null;
          search_ids: string[];
          search_snapshot: Json;
          started_at: string | null;
          state: string;
          trigger: string;
        };
        Insert: {
          created_at?: string;
          email_state?: string;
          error_category?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          request_key?: string | null;
          requested_by?: string | null;
          scheduled_at?: string | null;
          search_ids?: string[];
          search_snapshot?: Json;
          started_at?: string | null;
          state?: string;
          trigger?: string;
        };
        Update: {
          created_at?: string;
          email_state?: string;
          error_category?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          request_key?: string | null;
          requested_by?: string | null;
          scheduled_at?: string | null;
          search_ids?: string[];
          search_snapshot?: Json;
          started_at?: string | null;
          state?: string;
          trigger?: string;
        };
        Relationships: [];
      };
      crawl_source_runs: {
        Row: {
          count: number;
          error_category: string | null;
          id: number;
          job_id: string;
          outcome: string;
          search_id: string | null;
          source: string;
        };
        Insert: {
          count?: number;
          error_category?: string | null;
          id?: never;
          job_id: string;
          outcome: string;
          search_id?: string | null;
          source: string;
        };
        Update: {
          count?: number;
          error_category?: string | null;
          id?: never;
          job_id?: string;
          outcome?: string;
          search_id?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'crawl_source_runs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'crawl_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crawl_source_runs_search_id_fkey';
            columns: ['search_id'];
            isOneToOne: false;
            referencedRelation: 'saved_searches';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_marks: {
        Row: {
          listing_id: string;
          note: string | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          listing_id: string;
          note?: string | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          listing_id?: string;
          note?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_marks_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listing_comparisons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listing_marks_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_price_history: {
        Row: {
          id: number;
          job_id: string;
          listing_id: string;
          price_cents: number;
          seen_at: string;
        };
        Insert: {
          id?: never;
          job_id: string;
          listing_id: string;
          price_cents: number;
          seen_at?: string;
        };
        Update: {
          id?: never;
          job_id?: string;
          listing_id?: string;
          price_cents?: number;
          seen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_price_history_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'crawl_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listing_price_history_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listing_comparisons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listing_price_history_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      listings: {
        Row: {
          area_m2: number | null;
          availability: string;
          bedrooms: number | null;
          first_seen_at: string;
          has_elevator: boolean | null;
          has_parking: boolean | null;
          id: string;
          last_check_result: string;
          last_checked_at: string | null;
          last_seen_at: string | null;
          neighborhood: string | null;
          photo_url: string | null;
          price_cents: number | null;
          price_observed_at: string | null;
          removed_at: string | null;
          source: string;
          source_listing_id: string | null;
          suites: number | null;
          title: string;
          url: string;
        };
        Insert: {
          area_m2?: number | null;
          availability?: string;
          bedrooms?: number | null;
          first_seen_at?: string;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          id?: string;
          last_check_result?: string;
          last_checked_at?: string | null;
          last_seen_at?: string | null;
          neighborhood?: string | null;
          photo_url?: string | null;
          price_cents?: number | null;
          price_observed_at?: string | null;
          removed_at?: string | null;
          source: string;
          source_listing_id?: string | null;
          suites?: number | null;
          title: string;
          url: string;
        };
        Update: {
          area_m2?: number | null;
          availability?: string;
          bedrooms?: number | null;
          first_seen_at?: string;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          id?: string;
          last_check_result?: string;
          last_checked_at?: string | null;
          last_seen_at?: string | null;
          neighborhood?: string | null;
          photo_url?: string | null;
          price_cents?: number | null;
          price_observed_at?: string | null;
          removed_at?: string | null;
          source?: string;
          source_listing_id?: string | null;
          suites?: number | null;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          bedrooms: number[];
          created_at: string;
          enabled: boolean;
          has_elevator: boolean | null;
          has_parking: boolean | null;
          id: string;
          max_area_m2: number;
          max_price_cents: number;
          min_area_m2: number;
          min_price_cents: number;
          min_suites: number;
          name: string;
          neighborhoods: string[];
          sources: string[];
        };
        Insert: {
          bedrooms: number[];
          created_at?: string;
          enabled?: boolean;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          id?: string;
          max_area_m2: number;
          max_price_cents: number;
          min_area_m2: number;
          min_price_cents: number;
          min_suites: number;
          name: string;
          neighborhoods: string[];
          sources: string[];
        };
        Update: {
          bedrooms?: number[];
          created_at?: string;
          enabled?: boolean;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          id?: string;
          max_area_m2?: number;
          max_price_cents?: number;
          min_area_m2?: number;
          min_price_cents?: number;
          min_suites?: number;
          name?: string;
          neighborhoods?: string[];
          sources?: string[];
        };
        Relationships: [];
      };
    };
    Views: {
      crawl_run_source_summaries: {
        Row: {
          count: number | null;
          error_category: string | null;
          id: number | null;
          inconclusive: number | null;
          job_id: string | null;
          outcome: string | null;
          source: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'crawl_source_runs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'crawl_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_comparisons: {
        Row: {
          area_m2: number | null;
          availability: string | null;
          bedrooms: number | null;
          cohort: string | null;
          comparison_at: string | null;
          discount_pct: number | null;
          first_seen_at: string | null;
          has_elevator: boolean | null;
          has_parking: boolean | null;
          id: string | null;
          last_check_result: string | null;
          last_checked_at: string | null;
          last_seen_at: string | null;
          median_m2: number | null;
          neighborhood: string | null;
          peer_count: number | null;
          photo_url: string | null;
          price_cents: number | null;
          price_observed_at: string | null;
          removed_at: string | null;
          source: string | null;
          source_listing_id: string | null;
          suites: number | null;
          title: string | null;
          url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_crawl_job: { Args: { p_kind: string }; Returns: Json };
      enqueue_crawl: {
        Args: { request_key: string; search_ids: string[] };
        Returns: Json;
      };
      enqueue_scheduled_crawl: { Args: never; Returns: Json };
      finish_crawl_job: {
        Args: {
          p_email: string;
          p_error?: string;
          p_job: string;
          p_state: string;
          p_token: number;
        };
        Returns: undefined;
      };
      is_app_owner: { Args: never; Returns: boolean };
      record_crawl_source: {
        Args: {
          p_count: number;
          p_error: string;
          p_job: string;
          p_outcome: string;
          p_search: string;
          p_source: string;
          p_token: number;
        };
        Returns: undefined;
      };
      record_worker_heartbeat: { Args: never; Returns: undefined };
      renew_worker_lease: {
        Args: { p_job: string; p_token: number };
        Returns: undefined;
      };
      save_listing_batch: {
        Args: {
          p_items: Json;
          p_job: string;
          p_search?: string;
          p_token: number;
        };
        Returns: Json;
      };
      seed_saved_search: { Args: never; Returns: undefined };
      worker_health: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
        'Tables'
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
        'Views'
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
      'Tables'
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
      'Views'
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema['Tables']
    & DefaultSchema['Views']
  ) ? (
      & DefaultSchema['Tables']
      & DefaultSchema['Views']
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
      'Tables'
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
    'Tables'
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
      'Tables'
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']][
    'Tables'
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']][
      'Enums'
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions['schema']
    ]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']][
    'CompositeTypes'
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
