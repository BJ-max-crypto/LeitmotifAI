import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createBrowserSupabase(getToken: () => Promise<string | null>) {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient<Database>(url, key, {
    async accessToken() {
      return getToken();
    },
  });
}

export type BrowserSupabase = SupabaseClient<Database>;
