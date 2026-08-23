import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/supabase/ensure-workspace";

function displayName(metadata: Record<string, unknown>, email: string | undefined) {
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : "";
  const name = typeof metadata.name === "string" ? metadata.name : "";
  return fullName || name || email?.split("@")[0] || "Writer";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/editor";
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", oauthError);
    return NextResponse.redirect(login);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const login = new URL("/login", origin);
      login.searchParams.set("error", error.message);
      return NextResponse.redirect(login);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.rpc("ensure_user_workspace");
    await ensureWorkspace(supabase, user);

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name = displayName(metadata, user.email);
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const provider = user.app_metadata?.provider;
    if (provider === "google" && Date.now() - createdAt < 2 * 60 * 1000) {
      await notifySlack({
        type: "signup",
        name,
        email: user.email || "",
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
