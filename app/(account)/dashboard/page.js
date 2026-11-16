import { redirect } from "next/navigation";
import Link from "next/link";
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
  const billingMessage = billing === "no-subscription"
    ? "There isn’t a subscription to manage yet. You can upgrade from the planner."
    : billing === "already-active"
      ? "You already have a subscription. Use Manage subscription to make changes."
      : billing === "success" ? "Thanks. Stripe is confirming your subscription."
        : billing === "cancelled" ? "Checkout was canceled." : null;

  return <section className="account-card">
    <p className="eyebrow">You’re at home here</p>
    <h1>Welcome, {session.user.name || "cook"}.</h1>
    <p>You’re signed in as <strong>{session.user.email}</strong>.</p>
    <p>Your account is ready. Let’s make this week’s meals a little easier.</p>
    {billingMessage && <p role="status">{billingMessage}</p>}
    <div className="dashboard-actions">
      <Link className="button" href="/planner">Open your meal planner <span aria-hidden="true">→</span></Link>
      <form action="/api/billing/portal" method="post"><button className="billing-secondary" type="submit">Manage subscription</button></form>
      <LogoutButton />
    </div>
  </section>;
}
