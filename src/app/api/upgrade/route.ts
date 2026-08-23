import Stripe from "stripe";
import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { notifySlack } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/database.types";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function priceIdFor(plan: "pro" | "pro_plus") {
  return plan === "pro"
    ? process.env.STRIPE_PRICE_PRO
    : process.env.STRIPE_PRICE_PRO_PLUS;
}

async function applyPlanUpgrade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  plan: "pro" | "pro_plus",
) {
  const limit = PLAN_LIMITS[plan];
  const [{ data: profile }] = await Promise.all([
    supabase
      .from("profiles")
      .update({ plan_tier: plan })
      .eq("id", userId)
      .select("full_name, email, plan_tier")
      .single(),
    supabase
      .from("user_credits")
      .update({ credits_used: 0, credits_limit: limit })
      .eq("user_id", userId),
  ]);

  return profile;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { plan?: PlanTier };
  if (body.plan !== "pro" && body.plan !== "pro_plus") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const stripe = stripeClient();
  const priceId = priceIdFor(body.plan);
  const origin = new URL(request.url).origin;

  if (stripe && priceId) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?upgraded=${body.plan}`,
      cancel_url: `${origin}/editor`,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id, plan: body.plan },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  }

  const profile = await applyPlanUpgrade(supabase, user.id, body.plan);
  await notifySlack({
    type: "upgrade",
    name: profile?.full_name || user.email || "Writer",
    email: profile?.email || user.email || "",
    plan: body.plan,
  });

  const { data: credits } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    credits: {
      used: credits?.credits_used ?? 0,
      limit: credits?.credits_limit ?? PLAN_LIMITS[body.plan],
      remaining: Math.max(
        (credits?.credits_limit ?? PLAN_LIMITS[body.plan]) - (credits?.credits_used ?? 0),
        0,
      ),
      plan: body.plan,
    },
  });
}
