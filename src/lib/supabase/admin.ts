import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseSecretKey } from "@/lib/supabase/env";
import { getServerSupabaseConfig } from "@/lib/supabase/runtime";

export async function createAdminClient() {
  const { url } = await getServerSupabaseConfig();
  const key = getSupabaseSecretKey();
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
