import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getAuth } from "../../../../lib/auth/server";
import { grantPremiumAccess } from "../../../../lib/app-data";

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
    if (checkout.payment_status === "paid" && checkout.metadata?.userId === String(data.user.id)) {
      await grantPremiumAccess({
        userId: String(data.user.id),
        email: String(data.user.email),
        checkoutSessionId: checkout.id,
      });
      return <section className="account-card"><p className="eyebrow">Payment confirmed</p><h1>Premium is ready.</h1><p>Your account now has AI fridge photo scans and recipe suggestions.</p><Link className="button" href="/planner">Open the planner →</Link></section>;
    }
  } catch {
    // The webhook can still complete the entitlement if the confirmation request is delayed.
  }

  return <section className="account-card"><p className="eyebrow">Finishing up</p><h1>We’re confirming your payment.</h1><p>Stripe is still processing the checkout. Refresh this page in a moment or return to the planner.</p><Link className="button" href="/planner">Back to planner →</Link></section>;
}
