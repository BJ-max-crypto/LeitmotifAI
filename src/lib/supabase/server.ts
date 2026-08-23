import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { getServerSupabaseConfig } from "@/lib/supabase/runtime";

export async function createClient() {
  const { url, key } = await getServerSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component; proxy will refresh the session.
        }
      },
    },
  });
}
