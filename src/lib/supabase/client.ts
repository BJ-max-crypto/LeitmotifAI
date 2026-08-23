import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";

let injectedUrl = "";
let injectedKey = "";

export function setBrowserSupabaseConfig(url: string, key: string) {
  injectedUrl = url;
  injectedKey = key;
}

export function getBrowserSupabaseConfig() {
  const url = injectedUrl || getSupabaseUrl();
  const key = injectedKey || getSupabasePublicKey();
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = getBrowserSupabaseConfig();
  return Boolean(url && key);
}

export function createClient() {
  const { url, key } = getBrowserSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createBrowserClient<Database>(url, key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
    },
  });
}
