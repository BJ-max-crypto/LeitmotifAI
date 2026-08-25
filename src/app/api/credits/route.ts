import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { createClient, getClerkUserId } from "@/lib/supabase/server";

export async function GET() {
  const userId = await getClerkUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const [{ data: credits }, { data: profile }] = await Promise.all([
    supabase.from("user_credits").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("plan_tier").eq("id", userId).maybeSingle(),
  ]);

  const plan = profile?.plan_tier ?? "free";
  const expectedLimit = PLAN_LIMITS[plan];
  let limit = credits?.credits_limit ?? expectedLimit;
  const used = credits?.credits_used ?? 0;

  if (credits && credits.credits_limit !== expectedLimit) {
    await supabase
      .from("user_credits")
      .update({ credits_limit: expectedLimit })
      .eq("user_id", userId);
    limit = expectedLimit;
  }

  return NextResponse.json({
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    plan,
  });
}
