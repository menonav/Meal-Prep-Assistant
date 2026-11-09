import { redirect } from "next/navigation";
import { getAuth } from "../../../lib/auth/server";
import PlannerClient from "./planner-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly meal planner | Meal Prep Assistant" };

export default async function PlannerPage() {
  const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  if (!session?.user) redirect("/login");

  return <PlannerClient />;
}
