import { NextResponse } from "next/server";
import { findBillingUserByCustomerId, saveBillingCustomer } from "../../../../lib/billing/db.js";
import { getStripe } from "../../../../lib/stripe/server.js";

export const runtime = "nodejs";

function asId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function saveSubscriptionEvent(event, subscription) {
  const customerId = asId(subscription.customer);
  if (!customerId) return;
  const userId = subscription.metadata?.app_user_id || await findBillingUserByCustomerId(customerId);
  if (!userId) {
    console.error("[stripe-webhook] Subscription has no mapped app user.");
    return;
  }
  const firstItem = subscription.items?.data?.[0];
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  await saveBillingCustomer({
    userId: String(userId),
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: firstItem?.price?.id ?? null,
    currentPeriodEnd: periodEnd,
    eventCreated: event.created,
  });
}

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  let event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object;
      if (checkout.mode === "subscription" && checkout.subscription && checkout.customer) {
        const subscriptionId = asId(checkout.subscription);
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await saveSubscriptionEvent(event, subscription);
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await saveSubscriptionEvent(event, event.data.object);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Event processing failed.", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
