import { redirect } from "next/navigation";
import { getAuth } from "../../../lib/auth/server";
import PlannerClient from "./planner-client";
import { hasPremiumAccess } from "../../../lib/app-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly meal planner | Meal Prep Assistant" };

export default async function PlannerPage() {
  const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  if (!session?.user) redirect("/login");

  let premium = false;
  try { premium = await hasPremiumAccess(session.user); } catch { /* The planner still works locally if app-data storage is not configured. */ }
  const priceCents = Number.parseInt(process.env.STRIPE_PRICE_CENTS || "100", 10);
  return <PlannerClient userId={session.user.id} premium={premium} priceCents={Number.isInteger(priceCents) && priceCents >= 50 ? priceCents : 100} />;
}
