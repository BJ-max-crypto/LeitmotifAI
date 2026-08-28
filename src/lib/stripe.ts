import Stripe from "stripe";
import type { PlanTier } from "@/lib/supabase/database.types";

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

export function priceIdForPlan(plan: "pro" | "pro_plus") {
  return (
    (plan === "pro"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_PRO_PLUS)?.trim() || ""
  );
}

export function isStripeCheckoutConfigured() {
  return Boolean(
    getStripeSecretKey() &&
      priceIdForPlan("pro") &&
      priceIdForPlan("pro_plus"),
  );
}

export function createStripeClient() {
  const key = getStripeSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

export function isPaidPlan(plan: string | undefined): plan is "pro" | "pro_plus" {
  return plan === "pro" || plan === "pro_plus";
}

export function planFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined,
): PlanTier | null {
  const plan = metadata?.plan;
  if (plan === "pro" || plan === "pro_plus" || plan === "free") return plan;
  return null;
}
