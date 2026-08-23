import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: credits }, { data: profile }] = await Promise.all([
    supabase.from("user_credits").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("plan_tier").eq("id", user.id).maybeSingle(),
  ]);

  const used = credits?.credits_used ?? 0;
  const limit = credits?.credits_limit ?? 50;

  return NextResponse.json({
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan: profile?.plan_tier ?? "free",
  });
}
