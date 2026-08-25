import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getServerSupabaseConfig } from "@/lib/supabase/runtime";

export async function getClerkUserId() {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

export async function createClient() {
  const { url, key } = await getServerSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { getToken } = await auth();

  return createSupabaseClient<Database>(url, key, {
    async accessToken() {
      return getToken();
    },
  });
}
