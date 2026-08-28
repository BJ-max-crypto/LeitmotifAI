import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanTier } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyPlanToUser(
  userId: string,
  plan: PlanTier,
  options?: { resetUsage?: boolean },
) {
  const supabase = await createAdminClient();
  const limit = PLAN_LIMITS[plan];
  const resetUsage = options?.resetUsage ?? plan !== "free";

  await supabase.from("profiles").update({ plan_tier: plan }).eq("id", userId);

  if (resetUsage) {
    await supabase
      .from("user_credits")
      .update({ credits_used: 0, credits_limit: limit })
      .eq("user_id", userId);
    return;
  }

  const { data } = await supabase
    .from("user_credits")
    .select("credits_used")
    .eq("user_id", userId)
    .maybeSingle();
  const used = Math.min(data?.credits_used ?? 0, limit);
  await supabase
    .from("user_credits")
    .update({ credits_used: used, credits_limit: limit })
    .eq("user_id", userId);
}
