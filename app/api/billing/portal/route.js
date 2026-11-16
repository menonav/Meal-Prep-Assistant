import { NextResponse } from "next/server";
import { getAuth } from "../../../../lib/auth/server.js";
import { findBillingCustomerByUserId } from "../../../../lib/billing/db.js";
import { findEntitlementCustomer } from "../../../../lib/app-data.js";
import { getStripe } from "../../../../lib/stripe/server.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const appUrl = new URL(request.url).origin;
    if (request.headers.get("origin") !== appUrl) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const { data: session, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 });
    if (!session?.user) return NextResponse.redirect(new URL("/login", appUrl), 303);

    const userId = String(session.user.id);
    const [legacy, entitlement] = await Promise.allSettled([
      findBillingCustomerByUserId(userId),
      findEntitlementCustomer(userId),
    ]);
    if (legacy.status === "rejected" && entitlement.status === "rejected") throw entitlement.reason;
    const records = [entitlement.value, legacy.value].filter((record) => record?.stripe_customer_id);
    const billing = records.find((record) => ["active", "trialing", "past_due", "unpaid"].includes(record.subscription_status)) ?? records[0];
    if (!billing) {
      return NextResponse.redirect(new URL("/dashboard?billing=no-subscription", appUrl), 303);
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error("[billing-portal] Request could not be completed.", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Billing management is temporarily unavailable." }, { status: 503 });
  }
}
