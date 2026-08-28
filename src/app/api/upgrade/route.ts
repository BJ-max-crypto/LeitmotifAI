import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/slack";
import { getClerkUserId } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/supabase/database.types";
import {
  createStripeClient,
  isStripeCheckoutConfigured,
  priceIdForPlan,
} from "@/lib/stripe";

export async function POST(request: Request) {
  const body = (await request.json()) as { plan?: PlanTier };
  if (body.plan !== "pro" && body.plan !== "pro_plus") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const userId = await getClerkUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, and STRIPE_PRICE_PRO_PLUS.",
      },
      { status: 503 },
    );
  }

  const stripe = createStripeClient();
  const priceId = priceIdForPlan(body.plan);
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/editor?checkout=success&plan=${body.plan}`,
    cancel_url: `${origin}/editor?checkout=canceled`,
    client_reference_id: userId,
    customer_email: email,
    allow_promotion_codes: true,
    metadata: { user_id: userId, plan: body.plan },
    subscription_data: {
      metadata: { user_id: userId, plan: body.plan },
      ...(body.plan === "pro" ? { trial_period_days: 14 } : {}),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  await notifySlack("upgrade", `${userId} started Stripe checkout for ${body.plan}.`);

  return NextResponse.json({ checkoutUrl: session.url });
}
