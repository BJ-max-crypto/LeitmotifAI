import type { PlanTier } from "@/lib/supabase/database.types";

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 50,
  pro: 2000,
  pro_plus: 6000,
};

export const PLAN_PRICES: Record<PlanTier, number> = {
  free: 0,
  pro: 19,
  pro_plus: 49,
};

export type PlanCopy = {
  id: PlanTier;
  name: string;
  badge: string;
  price: number;
  description: string;
  features: string[];
  cta: string;
};

export const PLAN_COPY: Record<PlanTier, PlanCopy> = {
  free: {
    id: "free",
    name: "Free",
    badge: "Starter",
    price: 0,
    description: "Perfect for testing the waters and exploring AI-assisted writing.",
    features: [
      "50 free credits (one-time trial)",
      "Standard Claude 3.5 Sonnet access",
      "Personal onboarding preference customization",
      "Basic Markdown export",
    ],
    cta: "Your Current Plan",
  },
  pro: {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    price: 19,
    description: "For dedicated writers, essayists, and creators drafting regular content.",
    features: [
      "2,000 credits / month",
      "Full access to all 8 core genres (including Screenplay & Fantasy)",
      "Real-time auto-saving & unlimited cloud document storage",
      "Tone, perspective, and style prompt injection",
      "Standard export formats (PDF, Markdown, TXT)",
    ],
    cta: "Start 14-Day Pro Trial",
  },
  pro_plus: {
    id: "pro_plus",
    name: "Pro Plus",
    badge: "POWER USER",
    price: 49,
    description:
      "Unlocks maximum AI context depth, priority generation speed, custom voice training, and industry-standard exports.",
    features: [
      "6,000 credits / month (3x Pro usage)",
      "Priority streaming speed & zero-queue response time",
      "Deep Context Window (analyzes full manuscripts & multi-act outlines)",
      "Custom Style & Voice Memory (trains AI on your personal writing style)",
      "Advanced Industry Exports (.fdx Final Draft, EPUB, Formatted PDF)",
      "Priority 24/7 dedicated support",
    ],
    cta: "Unlock Pro Plus Power",
  },
};

export function planLabel(plan: PlanTier) {
  if (plan === "pro") return "Pro";
  if (plan === "pro_plus") return "Pro Plus";
  return "Free";
}

export function formatCreditCount(value: number) {
  return value.toLocaleString("en-US");
}

export function initialsFromName(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
