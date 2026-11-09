import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "../../../lib/auth/server";
import LogoutButton from "../../components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account | Meal Prep Assistant" };

export default async function DashboardPage() {
  // Revalidate with Neon so expired or revoked sessions cannot use a cached cookie.
  const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  // Authorize on the server as well as in the proxy; never trust browser state.
  if (!session?.user) redirect("/login");

  return <section className="account-card"><p className="eyebrow">You’re at home here</p><h1>Welcome, {session.user.name || "cook"}.</h1><p>You’re signed in as <strong>{session.user.email}</strong>.</p><p>Your account is ready. Let’s make this week’s meals a little easier.</p><div className="dashboard-actions"><Link className="button" href="/planner">Open your meal planner <span aria-hidden="true">→</span></Link><LogoutButton /></div></section>;
}
