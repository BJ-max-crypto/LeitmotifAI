import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyPlanToUser } from "@/lib/apply-plan";
import { notifySlack } from "@/lib/slack";
import {
  createStripeClient,
  getStripeWebhookSecret,
  isPaidPlan,
} from "@/lib/stripe";

export const runtime = "nodejs";

function metadataOf(
  source: { metadata?: Stripe.Metadata | null } | null | undefined,
) {
  return source?.metadata ?? {};
}

export async function POST(request: Request) {
  const stripe = createStripeClient();
  const secret = getStripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 501 });
  }

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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const plan = session.metadata?.plan;
      if (userId && isPaidPlan(plan)) {
        await applyPlanToUser(userId, plan, { resetUsage: true });
        await notifySlack("upgrade", `${userId} upgraded to ${plan} via Stripe.`);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = metadataOf(subscription).user_id;
        const plan = metadataOf(subscription).plan;
        if (userId && isPaidPlan(plan)) {
          await applyPlanToUser(userId, plan, { resetUsage: true });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = metadataOf(subscription).user_id;
      if (userId) {
        await applyPlanToUser(userId, "free", { resetUsage: false });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
