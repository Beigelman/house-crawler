export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      property_heartbeat: {
        Row: {
          seen_at: string;
          singleton: boolean;
        };
        Insert: {
          seen_at?: string;
          singleton?: boolean;
        };
        Update: {
          seen_at?: string;
          singleton?: boolean;
        };
        Relationships: [];
      };
      property_mark: {
        Row: {
          listing_link: string;
          note: string | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          listing_link: string;
          note?: string | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          listing_link?: string;
          note?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_mark_listing_link_fkey';
            columns: ['listing_link'];
            isOneToOne: false;
            referencedRelation: 'real_states';
            referencedColumns: ['link'];
          },
        ];
      };
      property_match: {
        Row: {
          listing_link: string;
          profile_id: string;
        };
        Insert: {
          listing_link: string;
          profile_id: string;
        };
        Update: {
          listing_link?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_match_listing_link_fkey';
            columns: ['listing_link'];
            isOneToOne: false;
            referencedRelation: 'real_states';
            referencedColumns: ['link'];
          },
          {
            foreignKeyName: 'property_match_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'property_profile';
            referencedColumns: ['id'];
          },
        ];
      };
      property_price: {
        Row: {
          id: number;
          legacy: boolean;
          listing_link: string;
          price_cents: number;
          run_id: string | null;
          seen_at: string;
        };
        Insert: {
          id?: number;
          legacy?: boolean;
          listing_link: string;
          price_cents: number;
          run_id?: string | null;
          seen_at?: string;
        };
        Update: {
          id?: number;
          legacy?: boolean;
          listing_link?: string;
          price_cents?: number;
          run_id?: string | null;
          seen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_price_listing_link_fkey';
            columns: ['listing_link'];
            isOneToOne: false;
            referencedRelation: 'real_states';
            referencedColumns: ['link'];
          },
          {
            foreignKeyName: 'property_price_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'property_run';
            referencedColumns: ['id'];
          },
        ];
      };
      property_profile: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          name: string;
          params: Json;
          providers: string[];
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          name: string;
          params: Json;
          providers: string[];
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          name?: string;
          params?: Json;
          providers?: string[];
        };
        Relationships: [];
      };
      property_request: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          profile_ids: string[];
          request_key: string;
          state: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          profile_ids: string[];
          request_key: string;
          state?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          profile_ids?: string[];
          request_key?: string;
          state?: string;
        };
        Relationships: [];
      };
      property_run: {
        Row: {
          email_state: string;
          error_category: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          profiles: Json;
          request_id: string | null;
          started_at: string;
          state: string;
        };
        Insert: {
          email_state?: string;
          error_category?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: string;
          profiles: Json;
          request_id?: string | null;
          started_at?: string;
          state?: string;
        };
        Update: {
          email_state?: string;
          error_category?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          profiles?: Json;
          request_id?: string | null;
          started_at?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_run_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: true;
            referencedRelation: 'property_request';
            referencedColumns: ['id'];
          },
        ];
      };
      property_source_run: {
        Row: {
          count: number;
          error_category: string | null;
          id: number;
          outcome: string;
          profile_id: string | null;
          run_id: string;
          source: string;
        };
        Insert: {
          count?: number;
          error_category?: string | null;
          id?: number;
          outcome: string;
          profile_id?: string | null;
          run_id: string;
          source: string;
        };
        Update: {
          count?: number;
          error_category?: string | null;
          id?: number;
          outcome?: string;
          profile_id?: string | null;
          run_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'property_source_run_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'property_profile';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_source_run_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'property_run';
            referencedColumns: ['id'];
          },
        ];
      };
      real_states: {
        Row: {
          area: number | null;
          availability: string;
          cohort: string | null;
          comparison_at: string | null;
          created_at: string | null;
          discount_pct: number | null;
          has_elevator: boolean | null;
          has_parking: boolean | null;
          last_seen_at: string | null;
          link: string;
          median_m2: number | null;
          neighborhood: string | null;
          peer_count: number | null;
          photo: string | null;
          price_cents: number | null;
          price_observed_at: string | null;
          rooms: number | null;
          source: string | null;
          suites: number | null;
          titulo: string;
          valor: string;
          verification: string;
        };
        Insert: {
          area?: number | null;
          availability?: string;
          cohort?: string | null;
          comparison_at?: string | null;
          created_at?: string | null;
          discount_pct?: number | null;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          last_seen_at?: string | null;
          link: string;
          median_m2?: number | null;
          neighborhood?: string | null;
          peer_count?: number | null;
          photo?: string | null;
          price_cents?: number | null;
          price_observed_at?: string | null;
          rooms?: number | null;
          source?: string | null;
          suites?: number | null;
          titulo: string;
          valor: string;
          verification?: string;
        };
        Update: {
          area?: number | null;
          availability?: string;
          cohort?: string | null;
          comparison_at?: string | null;
          created_at?: string | null;
          discount_pct?: number | null;
          has_elevator?: boolean | null;
          has_parking?: boolean | null;
          last_seen_at?: string | null;
          link?: string;
          median_m2?: number | null;
          neighborhood?: string | null;
          peer_count?: number | null;
          photo?: string | null;
          price_cents?: number | null;
          price_observed_at?: string | null;
          rooms?: number | null;
          source?: string | null;
          suites?: number | null;
          titulo?: string;
          valor?: string;
          verification?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_property_run: { Args: { p_kind: string }; Returns: Json };
      enqueue_property_crawl: {
        Args: { profile_ids: string[]; request_key: string };
        Returns: Json;
      };
      finish_property_run: {
        Args: {
          p_email: string;
          p_run: string;
          p_state: string;
          p_token: number;
        };
        Returns: undefined;
      };
      is_property_owner: { Args: never; Returns: boolean };
      record_property_source: {
        Args: {
          p_count: number;
          p_error: string;
          p_outcome: string;
          p_profile: string;
          p_run: string;
          p_source: string;
          p_token: number;
        };
        Returns: undefined;
      };
      renew_property_lease: {
        Args: { p_run: string; p_token: number };
        Returns: undefined;
      };
      save_property_batch: {
        Args: {
          p_items: Json;
          p_profile?: string;
          p_run: string;
          p_token: number;
        };
        Returns: Json;
      };
      seed_property_profile: { Args: never; Returns: undefined };
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
  public: {
    Enums: {},
  },
} as const;
