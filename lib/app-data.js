import "server-only";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { FRIDGE_DAILY_LIMIT } from "./fridge-limits";

let sql;
let initialized;

function database() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  sql ??= neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureTables() {
  if (!initialized) {
    initialized = (async () => {
      const query = database();
      await query`CREATE TABLE IF NOT EXISTS meal_prep_user_plans (
        user_id text PRIMARY KEY,
        plans jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_entitlements (
        user_id text PRIMARY KEY,
        email text NOT NULL,
        plan text NOT NULL DEFAULT 'free',
        stripe_session_id text UNIQUE,
        stripe_subscription_id text UNIQUE,
        stripe_customer_id text,
        subscription_status text NOT NULL DEFAULT 'active',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS stripe_subscription_id text`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS stripe_customer_id text`;
      await query`ALTER TABLE meal_prep_entitlements ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active'`;
      await query`CREATE UNIQUE INDEX IF NOT EXISTS meal_prep_entitlements_subscription_id_key
        ON meal_prep_entitlements (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_ai_usage (
        user_id text NOT NULL,
        usage_day date NOT NULL DEFAULT current_date,
        calls integer NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, usage_day)
      )`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_coach_usage (
        user_id text NOT NULL,
        usage_day date NOT NULL DEFAULT current_date,
        calls integer NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, usage_day)
      )`;
      await query`CREATE TABLE IF NOT EXISTS meal_prep_fridge_items (
        user_id text NOT NULL,
        id uuid NOT NULL,
        name text NOT NULL,
        name_key text NOT NULL,
        scanned_name_key text,
        expiry_date date,
        PRIMARY KEY (user_id, id),
        UNIQUE (user_id, name_key),
        UNIQUE (user_id, scanned_name_key)
      )`;
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  await initialized;
  return database();
}

export async function readPlans(userId) {
  const query = await ensureTables();
  const rows = await query`SELECT plans FROM meal_prep_user_plans WHERE user_id = ${userId}`;
  return rows[0]?.plans ?? {};
}

export async function writePlans(userId, plans) {
  const query = await ensureTables();
  await query`INSERT INTO meal_prep_user_plans (user_id, plans, updated_at)
    VALUES (${userId}, ${JSON.stringify(plans)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET plans = EXCLUDED.plans, updated_at = now()`;
}

async function hasMatchingStripeSubscription(user) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID || "price_1Ua5KUDpv9sPAKUVzVvp32dD";
  if (!secretKey) {
    console.warn("[subscription-access] Stripe secret missing in this deployment");
    return false;
  }
  if (!user?.email) return false;

  const stripe = new Stripe(secretKey);
  const customers = await stripe.customers.list({ email: user.email, limit: 100 });
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
    });
    if (subscriptions.data.some((subscription) =>
      ["active", "trialing"].includes(subscription.status)
      && subscription.items.data.some((item) => item.price.id === priceId)
      && (subscription.metadata?.app_user_id === String(user.id)
        || subscription.metadata?.userId === String(user.id)
        || user.emailVerified === true)
    )) return true;
  }
  console.warn("[subscription-access]", customers.data.length
    ? "No active subscription matched the app account and configured plan"
    : "Stripe customer not found in the configured Stripe account");
  return false;
}

export async function hasPremiumAccess(user) {
  if (user?.email?.toLowerCase() === "demo@demo.com") return true;
  if (!user?.id) return false;

  try {
    const query = await ensureTables();

    // Production billing records are the primary source for subscriptions.
    try {
      const billingRows = await query`SELECT subscription_status
        FROM app_billing_customers WHERE user_id = ${user.id} LIMIT 1`;
      if (["active", "trialing"].includes(billingRows[0]?.subscription_status)) return true;
    } catch {
      // Preview database branches may not contain the production billing table.
    }

    const rows = await query`SELECT plan, subscription_status
      FROM meal_prep_entitlements WHERE user_id = ${user.id}`;
    if (rows[0]?.plan === "premium"
      && ["active", "trialing"].includes(rows[0]?.subscription_status)) return true;
  } catch {
    // Stripe can still verify a paid subscription if Neon is unavailable here.
  }

  // Preview deployments may use a separate Neon branch. Verify this account's
  // subscription against the same monthly Plus price configured in Stripe.
  try {
    return await hasMatchingStripeSubscription(user);
  } catch (error) {
    console.warn("[subscription-access] Stripe lookup failed", error?.type || "Unknown error");
    return false;
  }
}

export async function syncStripeSubscription({
  userId,
  email,
  checkoutSessionId = null,
  subscriptionId,
  customerId = null,
  status,
}) {
  if (!userId || !email || !subscriptionId || !status) {
    throw new Error("Stripe subscription is missing account metadata.");
  }
  const query = await ensureTables();
  const hasAccess = ["active", "trialing"].includes(status);
  await query`INSERT INTO meal_prep_entitlements
      (user_id, email, plan, stripe_session_id, stripe_subscription_id, stripe_customer_id, subscription_status, updated_at)
    VALUES (
      ${userId},
      ${email},
      ${hasAccess ? "premium" : "free"},
      ${checkoutSessionId},
      ${subscriptionId},
      ${customerId},
      ${status},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      plan = EXCLUDED.plan,
      stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, meal_prep_entitlements.stripe_session_id),
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, meal_prep_entitlements.stripe_customer_id),
      subscription_status = EXCLUDED.subscription_status,
      updated_at = now()`;
}

export async function consumeAiQuota(userId, dailyLimit = FRIDGE_DAILY_LIMIT) {
  const query = await ensureTables();
  const rows = await query`INSERT INTO meal_prep_ai_usage (user_id, usage_day, calls)
    VALUES (${userId}, current_date, 1)
    ON CONFLICT (user_id, usage_day) DO UPDATE
      SET calls = meal_prep_ai_usage.calls + 1
      WHERE meal_prep_ai_usage.calls < ${dailyLimit}
    RETURNING calls`;
  return rows[0]?.calls ?? null;
}

export const COACH_DAILY_LIMIT = 50;

export async function consumeCoachQuota(userId) {
  const query = await ensureTables();
  const rows = await query`INSERT INTO meal_prep_coach_usage (user_id, calls)
    VALUES (${userId}, 1)
    ON CONFLICT (user_id, usage_day) DO UPDATE SET calls = meal_prep_coach_usage.calls + 1
    WHERE meal_prep_coach_usage.calls < ${COACH_DAILY_LIMIT}
    RETURNING calls`;
  return rows.length > 0;
}

function fridgeItemNameKey(name) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function readFridgeItems(userId) {
  const query = await ensureTables();
  return query`SELECT id, name, to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate"
    FROM meal_prep_fridge_items WHERE user_id = ${userId}
    ORDER BY expiry_date NULLS LAST, name, id`;
}

export async function saveScannedFridgeItems(userId, ingredients) {
  const items = ingredients.slice(0, 40).flatMap((ingredient) => {
    if (typeof ingredient !== "string") return [];
    const name = ingredient.trim().slice(0, 120);
    return name ? [{ id: crypto.randomUUID(), name, name_key: fridgeItemNameKey(name) }] : [];
  });
  if (!items.length) return;
  const query = await ensureTables();
  await query`INSERT INTO meal_prep_fridge_items (user_id, id, name, name_key, scanned_name_key)
    SELECT ${userId}, id, name, name_key, name_key
    FROM jsonb_to_recordset(${JSON.stringify(items)}::jsonb) AS item(id uuid, name text, name_key text)
    ON CONFLICT DO NOTHING`;
}

export async function addFridgeItem(userId, { name, expiryDate }) {
  const query = await ensureTables();
  const [item] = await query`INSERT INTO meal_prep_fridge_items (user_id, id, name, name_key, expiry_date)
    VALUES (${userId}, ${crypto.randomUUID()}::uuid, ${name}, ${fridgeItemNameKey(name)}, ${expiryDate}::date)
    RETURNING id, name, to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate"`;
  return item;
}

export async function updateFridgeItem(userId, { id, name, expiryDate }) {
  const query = await ensureTables();
  const [item] = await query`UPDATE meal_prep_fridge_items
    SET name = ${name}, name_key = ${fridgeItemNameKey(name)}, expiry_date = ${expiryDate}::date
    WHERE user_id = ${userId} AND id = ${id}::uuid
    RETURNING id, name, to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate"`;
  return item;
}

export async function deleteFridgeItem(userId, id) {
  const query = await ensureTables();
  const removed = await query`DELETE FROM meal_prep_fridge_items
    WHERE user_id = ${userId} AND id = ${id}::uuid RETURNING id`;
  return removed.length > 0;
}
