import { cookies } from "next/headers";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { SB_KEY_COOKIE, SB_URL_COOKIE } from "@/lib/supabase/cookie-names";

export { SB_KEY_COOKIE, SB_URL_COOKIE, isValidSupabaseUrl } from "@/lib/supabase/cookie-names";

export function getSupabaseUrlFromCookies(
  store: { get: (name: string) => { value: string } | undefined },
) {
  return getSupabaseUrl() || store.get(SB_URL_COOKIE)?.value || "";
}

export function getSupabasePublicKeyFromCookies(
  store: { get: (name: string) => { value: string } | undefined },
) {
  return getSupabasePublicKey() || store.get(SB_KEY_COOKIE)?.value || "";
}

export async function getServerSupabaseConfig() {
  const store = await cookies();
  return {
    url: getSupabaseUrlFromCookies(store),
    key: getSupabasePublicKeyFromCookies(store),
  };
}
