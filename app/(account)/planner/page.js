import { redirect } from "next/navigation";
import { getAuth } from "../../../lib/auth/server";
import PlannerClient from "./planner-client";
import { RECIPES } from "./recipes";
import { hasPremiumAccess } from "../../../lib/app-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly meal planner | Meal Prep Assistant" };

export default async function PlannerPage() {
  const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
  if (error) throw new Error("Account access is temporarily unavailable.");
  if (!session?.user) redirect("/login");

  let premium = false;
  try { premium = await hasPremiumAccess(session.user); } catch { /* The planner still works locally if app-data storage is not configured. */ }
  const recipes = premium ? RECIPES : RECIPES.map(({ id, title, emoji, time, servings }) => ({
    id, title, emoji, time, servings,
  }));
  return <PlannerClient userId={session.user.id} premium={premium} recipes={recipes} />;
}
