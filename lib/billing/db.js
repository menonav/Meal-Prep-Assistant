import "server-only";
import { neon } from "@neondatabase/serverless";

let sql;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  sql ??= neon(databaseUrl);
  return sql;
}

export async function findBillingCustomerByUserId(userId) {
  const rows = await getSql()`
    SELECT user_id, stripe_customer_id, subscription_id, subscription_status
    FROM app_billing_customers WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findBillingUserByCustomerId(customerId) {
  const rows = await getSql()`
    SELECT user_id FROM app_billing_customers
    WHERE stripe_customer_id = ${customerId} LIMIT 1
  `;
  return rows[0]?.user_id ?? null;
}

export async function saveBillingCustomer({
  userId,
  customerId,
  subscriptionId = null,
  status = null,
  priceId = null,
  currentPeriodEnd = null,
  eventCreated = 0,
}) {
  await getSql()`
    INSERT INTO app_billing_customers
      (user_id, stripe_customer_id, subscription_id, subscription_status, price_id, current_period_end, last_event_created)
    VALUES
      (${userId}, ${customerId}, ${subscriptionId}, ${status}, ${priceId}, ${currentPeriodEnd}, ${eventCreated})
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      subscription_id = EXCLUDED.subscription_id,
      subscription_status = EXCLUDED.subscription_status,
      price_id = EXCLUDED.price_id,
      current_period_end = EXCLUDED.current_period_end,
      last_event_created = EXCLUDED.last_event_created,
      updated_at = NOW()
    WHERE app_billing_customers.last_event_created <= EXCLUDED.last_event_created
  `;
}
