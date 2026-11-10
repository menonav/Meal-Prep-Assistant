import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getAuth } from "../../../../lib/auth/server";
import { syncStripeSubscription } from "../../../../lib/app-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premium access | Meal Prep Assistant" };

export default async function PaymentSuccessPage({ searchParams }) {
  const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  if (!data?.user?.id) redirect("/login");

  const params = await searchParams;
  const sessionId = params?.session_id;
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) redirect("/planner?payment=pending");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const checkout = await stripe.checkout.sessions.retrieve(String(sessionId));
    if (checkout.mode === "subscription"
        && checkout.status === "complete"
        && checkout.metadata?.userId === String(data.user.id)
        && checkout.subscription) {
      const subscriptionId = typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.metadata?.userId === String(data.user.id)) {
        await syncStripeSubscription({
          userId: String(data.user.id),
          email: String(data.user.email || ""),
          checkoutSessionId: checkout.id,
          subscriptionId: subscription.id,
          customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
          status: subscription.status,
        });
        return <section className="account-card"><p className="eyebrow">Subscription confirmed</p><h1>Premium is ready.</h1><p>Your account now has monthly AI fridge photo scans and recipe suggestions.</p><Link className="button" href="/planner">Open the planner →</Link></section>;
      }
    }
  } catch {
    // The webhook can still sync the entitlement if this confirmation is delayed.
  }

  return <section className="account-card"><p className="eyebrow">Finishing up</p><h1>We’re confirming your subscription.</h1><p>Stripe is still processing the checkout. Refresh this page in a moment or return to the planner.</p><Link className="button" href="/planner">Back to planner →</Link></section>;
}
