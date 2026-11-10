import Stripe from "stripe";
import { NextResponse } from "next/server";
import { grantPremiumAccess } from "../../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  const session = event.data?.object;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)
      && session?.mode === "payment"
      && session.payment_status === "paid"
      && session.metadata?.userId
      && session.metadata?.userEmail) {
    try {
      await grantPremiumAccess({
        userId: session.metadata.userId,
        email: session.metadata.userEmail,
        checkoutSessionId: session.id,
      });
    } catch {
      // A non-2xx response asks Stripe to retry, so do not acknowledge until stored.
      return NextResponse.json({ error: "Could not save purchase access." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
