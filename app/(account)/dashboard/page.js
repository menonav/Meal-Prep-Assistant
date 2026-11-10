import { redirect } from "next/navigation";
import { getAuth } from "../../../lib/auth/server";
import LogoutButton from "../../components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account | Meal Prep Assistant" };

export default async function DashboardPage({ searchParams }) {
  // Revalidate with Neon so expired or revoked sessions cannot use a cached cookie.
  const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  // Authorize on the server as well as in the proxy; never trust browser state.
  if (!session?.user) redirect("/login");

  const { billing } = await searchParams;
  const billingMessage = billing === "success"
    ? "Thanks. Stripe is confirming your subscription; billing status will sync automatically."
    : billing === "cancelled"
      ? "Checkout was canceled. No subscription was started."
      : billing === "already-active"
        ? "You already have a subscription. Use Manage subscription to make changes."
        : billing === "no-subscription"
          ? "There isn’t a billing profile to manage yet. Start checkout to subscribe."
          : null;

  return <section className="account-card">
    <p className="eyebrow">You’re at home here</p>
    <h1>Welcome, {session.user.name || "cook"}.</h1>
    <p>You’re signed in as <strong>{session.user.email}</strong>.</p>
    <p>Your account is ready. Start your Meal Prep Assistant subscription or manage an existing plan below.</p>
    {billingMessage && <p className="billing-message" role="status">{billingMessage}</p>}
    <div className="billing-actions">
      <form action="/api/billing/checkout" method="post">
        <button className="button" type="submit">Continue to secure checkout <span aria-hidden="true">→</span></button>
      </form>
      <form action="/api/billing/portal" method="post">
        <button className="billing-secondary" type="submit">Manage subscription</button>
      </form>
    </div>
    <p className="account-help">Payments are handled securely by Stripe. You can update or cancel through the billing portal.</p>
    <LogoutButton />
  </section>;
}
