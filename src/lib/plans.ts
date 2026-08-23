import type { PlanTier } from "@/lib/supabase/database.types";

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 50,
  pro: 2000,
  pro_plus: 4000,
};

export function planLabel(plan: PlanTier) {
  if (plan === "pro") return "Pro Plan";
  if (plan === "pro_plus") return "Pro Plus";
  return "Free Plan";
}

export function initialsFromName(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
