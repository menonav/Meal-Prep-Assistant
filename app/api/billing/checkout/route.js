import { NextResponse } from "next/server";
import { getAuth } from "../../../../lib/auth/server.js";
import { findBillingCustomerByUserId, saveBillingCustomer } from "../../../../lib/billing/db.js";
import { getAppUrl, getStripe } from "../../../../lib/stripe/server.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const appUrl = getAppUrl();
    if (request.headers.get("origin") !== appUrl) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 });
    if (!session?.user) return NextResponse.redirect(new URL("/login", appUrl), 303);

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return NextResponse.json({ error: "The subscription price is not configured yet." }, { status: 503 });

    const stripe = getStripe();
    const existing = await findBillingCustomerByUserId(session.user.id);
    if (["active", "trialing", "past_due", "unpaid"].includes(existing?.subscription_status)) {
      return NextResponse.redirect(new URL("/dashboard?billing=already-active", appUrl), 303);
    }

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: { app_user_id: String(session.user.id) },
      }, { idempotencyKey: `meal-prep-customer-${session.user.id}` });
      customerId = customer.id;
      await saveBillingCustomer({ userId: String(session.user.id), customerId });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(session.user.id),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { app_user_id: String(session.user.id) } },
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/dashboard?billing=cancelled`,
    });

    if (!checkout.url) return NextResponse.json({ error: "Stripe did not return a Checkout URL." }, { status: 502 });
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("[billing-checkout] Request could not be completed.", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Check billing configuration and try again." }, { status: 503 });
  }
}
