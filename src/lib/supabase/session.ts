import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { SB_KEY_COOKIE, SB_URL_COOKIE } from "@/lib/supabase/cookie-names";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

export async function updateSession(request: NextRequest) {
  const url = getSupabaseUrl() || request.cookies.get(SB_URL_COOKIE)?.value || "";
  const key = getSupabasePublicKey() || request.cookies.get(SB_KEY_COOKIE)?.value || "";
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isCallback = pathname.startsWith("/auth/callback");
  const isLogin = pathname.startsWith("/login");
  const isProtected =
    pathname.startsWith("/editor") ||
    pathname.startsWith("/settings") ||
    pathname === "/";

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return copyCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  if (user && isLogin && !isCallback) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/editor";
    redirectUrl.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  return supabaseResponse;
}
