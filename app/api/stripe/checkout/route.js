import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getAuth } from "../../../../lib/auth/server";
import { hasPremiumAccess } from "../../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let user;
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return NextResponse.json({ error: "Could not verify your session." }, { status: 503 });
    if (!data?.user?.id) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
    user = data.user;
  } catch {
    return NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 });
  }

  try {
    if (await hasPremiumAccess(user)) return NextResponse.json({ error: "Premium is already active on your account." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Database access is not configured yet." }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe checkout is not configured yet." }, { status: 503 });
  }
  const amount = Number.parseInt(process.env.STRIPE_PRICE_CENTS || "999", 10);
  if (!Number.isInteger(amount) || amount < 50 || amount > 1_000_000) {
    return NextResponse.json({ error: "The premium price is not configured correctly." }, { status: 503 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = new URL(request.url).origin;
    const metadata = { userId: String(user.id), userEmail: String(user.email || "") };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          recurring: { interval: "month" },
          product_data: {
            name: "Meal Prep Assistant Premium",
            description: "Monthly access to AI fridge photo scans and recipe suggestions",
          },
        },
      }],
      customer_email: user.email,
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planner?payment=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Couldn’t start checkout. Please try again." }, { status: 502 });
  }
}
