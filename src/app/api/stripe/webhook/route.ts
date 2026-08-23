import Stripe from "stripe";
import { NextResponse } from "next/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { notifySlack } from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }

  const stripe = new Stripe(key);
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;
  if (!userId || (plan !== "pro" && plan !== "pro_plus")) {
    return NextResponse.json({ received: true });
  }

  const supabase = await createAdminClient();
  const [{ data: profile }] = await Promise.all([
    supabase
      .from("profiles")
      .update({ plan_tier: plan })
      .eq("id", userId)
      .select("full_name, email")
      .maybeSingle(),
    supabase
      .from("user_credits")
      .update({ credits_used: 0, credits_limit: PLAN_LIMITS[plan] })
      .eq("user_id", userId),
  ]);

  await notifySlack({
    type: "upgrade",
    name: profile?.full_name || "Writer",
    email: profile?.email || "",
    plan,
  });

  return NextResponse.json({ received: true });
}
