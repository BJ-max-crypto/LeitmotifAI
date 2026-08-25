import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { notifySlack } from "@/lib/slack";
import { createClient, getClerkUserId } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/database.types";

export async function POST(request: Request) {
  const body = (await request.json()) as { plan?: PlanTier };
  if (body.plan !== "pro" && body.plan !== "pro_plus") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const userId = await getClerkUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const limit = PLAN_LIMITS[body.plan];
  await Promise.all([
    supabase.from("profiles").update({ plan_tier: body.plan }).eq("id", userId),
    supabase
      .from("user_credits")
      .update({ credits_used: 0, credits_limit: limit })
      .eq("user_id", userId),
  ]);

  const { data: credits } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  await notifySlack("upgrade", `${userId} upgraded to ${body.plan}.`);

  return NextResponse.json({
    ok: true,
    credits: {
      used: credits?.credits_used ?? 0,
      limit: credits?.credits_limit ?? limit,
      remaining: Math.max(
        (credits?.credits_limit ?? limit) - (credits?.credits_used ?? 0),
        0,
      ),
      plan: body.plan,
    },
  });
}
