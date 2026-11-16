import Stripe from "stripe";
import { NextResponse } from "next/server";
import { findBillingUserByCustomerId, saveBillingCustomer } from "../../../../lib/billing/db.js";
import { syncStripeSubscription } from "../../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function saveSubscription(subscription, eventCreated, checkoutSessionId = null) {
  const userId = subscription?.metadata?.userId;
  const email = subscription?.metadata?.userEmail;
  if (!subscription?.id || !subscription.status) return;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (userId && email) {
    await syncStripeSubscription({
      userId, email, checkoutSessionId, subscriptionId: subscription.id, customerId, status: subscription.status,
    });
    return;
  }
  if (!customerId) return;
  const legacyUserId = subscription.metadata?.app_user_id || await findBillingUserByCustomerId(customerId);
  if (!legacyUserId) return;
  const item = subscription.items?.data?.[0];
  const periodEnd = subscription.current_period_end ?? item?.current_period_end;
  await saveBillingCustomer({
    userId: legacyUserId,
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: item?.price?.id ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    eventCreated,
  });
}

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let stripe;
  let event;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    const object = event.data?.object;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (object?.mode === "subscription" && object?.subscription) {
        const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!object.metadata?.userId || subscription.metadata?.userId === object.metadata.userId) {
          await saveSubscription(subscription, event.created, object.id);
        }
      }
    } else if ([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)) {
      await saveSubscription(object, event.created);
    }
  } catch {
    // Stripe retries on non-2xx responses; acknowledge only after Neon is updated.
    return NextResponse.json({ error: "Could not sync subscription access." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
