export type PlanTier = "free" | "pro" | "pro_plus";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan_tier: PlanTier;
  writing_preferences: unknown | null;
  updated_at: string;
};

export type UserCredits = {
  user_id: string;
  credits_used: number;
  credits_limit: number;
};

export type DocumentRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          plan_tier?: PlanTier;
          writing_preferences?: unknown | null;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          plan_tier?: PlanTier;
          writing_preferences?: unknown | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_credits: {
        Row: UserCredits;
        Insert: {
          user_id: string;
          credits_used?: number;
          credits_limit?: number;
        };
        Update: {
          credits_used?: number;
          credits_limit?: number;
        };
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_credit: {
        Args: Record<string, never>;
        Returns: {
          ok: boolean;
          credits_used: number;
          credits_limit: number;
        }[];
      };
      ensure_user_workspace: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      plan_tier: PlanTier;
    };
    CompositeTypes: Record<string, never>;
  };
};
